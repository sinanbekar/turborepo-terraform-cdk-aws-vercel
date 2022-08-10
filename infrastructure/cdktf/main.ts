import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack } from "cdktf";
import * as path from "path";
import * as vercel from "./.gen/providers/vercel";
import * as aws from "@cdktf/provider-aws";
import * as random from "@cdktf/provider-random";
import {
  NodejsFunctionAsset,
  NodejsFunctionProps,
} from "./lib/nodejs-function";

import { nestEsBuildExternals } from "../../apps/api/util/esbuildOptions";

interface CommonStackConfig {
  monorepoPath: string;
}

type FrontendStackConfig = {
  apiUrl: string;
} & CommonStackConfig;

type BackendStackConfig = {} & NodejsFunctionProps;

const lambdaRolePolicy = {
  Version: "2012-10-17",
  Statement: [
    {
      Action: "sts:AssumeRole",
      Principal: {
        Service: "lambda.amazonaws.com",
      },
      Effect: "Allow",
      Sid: "",
    },
  ],
};

class BackendStack extends TerraformStack {
  public api: aws.apigatewayv2.Apigatewayv2Api;
  constructor(scope: Construct, name: string, config: BackendStackConfig) {
    super(scope, name);

    new aws.AwsProvider(this, "provider", {
      region: "eu-central-1",
    });

    new random.RandomProvider(this, "random");

    // Create random value
    const pet = new random.Pet(this, "randomName", {
      length: 2,
    });

    // Bundled zip
    const code = new NodejsFunctionAsset(this, "code", {
      bundling: config.bundling,
    });

    // Create Lambda role
    const role = new aws.iam.IamRole(this, "lambdaExec", {
      name: `lambda-${name}-${pet.id}`,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy),
    });

    // Add execution role for lambda to write to CloudWatch logs
    new aws.iam.IamRolePolicyAttachment(this, "lambdaManagedPolicy", {
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    });

    // Create Lambda function
    const lambdaFunc = new aws.lambdafunction.LambdaFunction(
      this,
      "lambdaFunction",
      {
        functionName: `serverless-api-lambda-${pet.id}`,
        handler: "index.handler",
        runtime: "nodejs16.x",
        filename: code.asset.path,
        sourceCodeHash: code.asset.assetHash,
        role: role.arn,
      }
    );

    // Create and configure API gateway
    this.api = new aws.apigatewayv2.Apigatewayv2Api(this, "apiGw", {
      name: name,
      protocolType: "HTTP",
      target: lambdaFunc.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
        allowHeaders: ["Content-Type", "x-requested-with"],
        allowMethods: ["GET", "PUT", "POST", "DELETE"],
      },
    });

    new aws.lambdafunction.LambdaPermission(this, "apiGwLambda", {
      functionName: lambdaFunc.functionName,
      action: "lambda:InvokeFunction",
      principal: "apigateway.amazonaws.com",
      sourceArn: `${this.api.executionArn}/*/*`,
    });

    new TerraformOutput(this, "backendUrl", {
      value: this.api.apiEndpoint,
    });
  }
}

class FrontendStack extends TerraformStack {
  constructor(scope: Construct, name: string, config: FrontendStackConfig) {
    super(scope, name);

    new vercel.VercelProvider(this, "provider");

    const webProjectDirectory = new vercel.DataVercelProjectDirectory(
      this,
      "webProjectDirectory",
      {
        path: config.monorepoPath,
      }
    );
    const webProject = new vercel.Project(this, "webProject", {
      name: "web-turborepo-frontend-terraform-cdk",
      framework: "nextjs",
      rootDirectory: "apps/web",
      environment: [
        {
          key: "NEXT_PUBLIC_API_URL",
          value: config.apiUrl,
          target: ["production", "development", "preview"],
        },
      ],
      buildCommand: "cd ../.. && pnpm turbo run build --filter=web",
    });

    const docsProjectDirectory = new vercel.DataVercelProjectDirectory(
      this,
      "docsProjectDirectory",
      {
        path: config.monorepoPath,
      }
    );
    const docsProject = new vercel.Project(this, "docsProject", {
      name: "docs-turborepo-frontend-terraform-cdk",
      framework: "nextjs",
      rootDirectory: "apps/docs",
      environment: [
        {
          key: "NEXT_PUBLIC_API_URL",
          value: config.apiUrl,
          target: ["production", "development", "preview"],
        },
      ],
      buildCommand: "cd ../.. && pnpm turbo run build --filter=docs",
    });

    const webDeployment = new vercel.Deployment(this, "webDeployment", {
      projectId: webProject.id,
      //@ts-ignore
      files: webProjectDirectory.files,
      pathPrefix: webProjectDirectory.path,
      production: true
    });

    const docsDeployment = new vercel.Deployment(this, "docsDeployment", {
      projectId: docsProject.id,
      //@ts-ignore
      files: docsProjectDirectory.files,
      pathPrefix: docsProjectDirectory.path,
      production: true
    });

    new TerraformOutput(this, "frontendUrlWeb", {
      value: webDeployment.url,
    });

    new TerraformOutput(this, "frontendUrlDocs", {
      value: docsDeployment.url,
    });
  }
}

const app = new App();
const monorepoPath = path.join(__dirname, "..", "..");

const backend = new BackendStack(app, "backend", {
  bundling: {
    entry: path.join(__dirname, "..", "..", "apps", "api", "dist", "lambda.js"),
    externalModules: ["aws-sdk", ...nestEsBuildExternals],
  },
});

const frontend = new FrontendStack(app, "frontend", {
  monorepoPath: monorepoPath,
  apiUrl: backend.api.apiEndpoint,
});

frontend.addDependency(backend);

app.synth();
