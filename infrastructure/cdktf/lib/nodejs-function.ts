// https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Resource, TerraformAsset, AssetType } from "cdktf";
import { Construct } from "constructs";
import {
  aws_lambda as lambda,
  BundlingOptions,
  AssetStaging,
} from "aws-cdk-lib";
import {
  Bundling,
  BundlingProps,
} from "aws-cdk-lib/aws-lambda-nodejs/lib/bundling";
import { findUp } from "aws-cdk-lib/aws-lambda-nodejs/lib/util";

export interface NodejsFunctionProps {
  readonly bundling: { entry: string } & Partial<BundlingProps>;
}

export class NodejsFunctionAsset extends Resource {
  public readonly asset: TerraformAsset;

  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    super(scope, id);

    const { bundling } = props;

    const entry = bundling.entry;
    const runtime = bundling.runtime ?? lambda.Runtime.NODEJS_16_X;
    const architecture = bundling.architecture ?? lambda.Architecture.X86_64;
    const depsLockFilePath =
      bundling.depsLockFilePath ?? (findUp("pnpm-lock.yaml") as string);
    const projectRoot = bundling.projectRoot ?? path.dirname(depsLockFilePath);

    const tempBundleDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "nodejs-lambda-bundle")
    );

    bundle(
      new Bundling({
        ...bundling,
        entry: entry,
        runtime: runtime,
        architecture: architecture,
        depsLockFilePath: depsLockFilePath,
        projectRoot: projectRoot,
      }),
      tempBundleDir,
      projectRoot
    );

    this.asset = new TerraformAsset(this, "lambdaAsset", {
      path: tempBundleDir,
      type: AssetType.ARCHIVE,
    });
  }
}

// Grabbed from aws-cdk-lib
// (https://github.com/aws/aws-cdk/blob/afb1c2df82120a4eeba367bc3c3a3f6a07c6adc2/packages/@aws-cdk/core/lib/asset-staging.ts)
// with some modifications.
function bundle(
  options: BundlingOptions,
  bundleDir: string,
  sourcePath: string
) {
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  } else {
    fs.mkdirSync(bundleDir, { recursive: true });
  }

  // Always mount input and output dir
  const volumes = [
    {
      hostPath: sourcePath,
      containerPath: AssetStaging.BUNDLING_INPUT_DIR,
    },
    {
      hostPath: bundleDir,
      containerPath: AssetStaging.BUNDLING_OUTPUT_DIR,
    },
    ...(options.volumes ?? []),
  ];

  let localBundling: boolean | undefined;
  try {
    localBundling = options.local?.tryBundle(bundleDir, options);
    if (!localBundling) {
      let user: string;
      if (options.user) {
        user = options.user;
      } else {
        // Default to current user
        const userInfo = os.userInfo();
        user =
          userInfo.uid !== -1 // uid is -1 on Windows
            ? `${userInfo.uid}:${userInfo.gid}`
            : "1000:1000";
      }
      options.image.run({
        command: options.command,
        user,
        volumes,
        environment: options.environment,
        workingDirectory:
          options.workingDirectory ?? AssetStaging.BUNDLING_INPUT_DIR,
        securityOpt: options.securityOpt ?? "",
      });
    }
  } catch (err) {
    throw new Error(`Bundling failed. err: ${err}`);
  }

  if (fs.readdirSync(bundleDir).length === 0) {
    // if dir empty
    const outputDir = localBundling
      ? bundleDir
      : AssetStaging.BUNDLING_OUTPUT_DIR;
    throw new Error(
      `Bundling did not produce any output. Check that content is written to ${outputDir}.`
    );
  }
}
