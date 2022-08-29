import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack } from "cdktf";
import * as path from "path";
import * as vercel from "./.gen/providers/vercel";
import * as aws from "@cdktf/provider-aws";
import * as random from "@cdktf/provider-random";
import { NodejsFunction, NodejsFunctionProps } from "./lib/lambda/function";

interface CommonStackConfig {
  region?: string;
}

type FrontendStackConfig = {
  apiUrl: string;
} & CommonStackConfig;

type BackendStackConfig = {
  api: {
    function: Partial<NodejsFunctionProps>;
  };
} & CommonStackConfig;

const monorepoPath = path.join(__dirname, "..", "..");
class BackendStack extends TerraformStack {
  public api: aws.apigatewayv2.Apigatewayv2Api;
  constructor(scope: Construct, name: string, config: BackendStackConfig) {
    super(scope, name);

    const { region = "eu-central-1" } = config;

    new aws.AwsProvider(this, "Provider", {
      region,
    });

    new random.RandomProvider(this, "Random");

    // random name
    const pet = new random.Pet(this, "RandomName", {
      length: 2,
    });

    const role = new aws.iam.IamRole(this, "LambdaRole", {
      name: `lambda-role-${name}-${pet.id}`,
      assumeRolePolicy: JSON.stringify({
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
      }),
    });

    new aws.iam.IamRolePolicyAttachment(this, "LambdaManagedPolicy", {
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    });

    const lambdaFunction = new NodejsFunction(this, "LambdaFunction", {
      entry: config.api.function.entry,
      functionName: `api-lambda-${pet.id}`,
      bundling: {
        minify: true,
        ...config.api.function.bundling,
      },
      role: role.arn,
      ...config.api.function,
    });

    this.api = new aws.apigatewayv2.Apigatewayv2Api(this, "ApiGw", {
      name: name,
      protocolType: "HTTP",
      target: lambdaFunction.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
        allowHeaders: ["Content-Type", "x-requested-with"],
        allowMethods: ["GET"],
      },
    });

    new aws.lambdafunction.LambdaPermission(this, "ApiGwLambda", {
      functionName: lambdaFunction.functionName,
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

    new vercel.VercelProvider(this, "Provider");

    const webProjectDirectory = new vercel.DataVercelProjectDirectory(
      this,
      "webProjectDirectory",
      {
        path: monorepoPath,
      }
    );
    const webProject = new vercel.Project(this, "WebProject", {
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
        path: monorepoPath,
      }
    );
    const docsProject = new vercel.Project(this, "DocsProject", {
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

    const webDeployment = new vercel.Deployment(this, "WebDeployment", {
      projectId: webProject.id,
      //@ts-ignore
      files: webProjectDirectory.files,
      pathPrefix: webProjectDirectory.path,
      production: true,
    });

    const docsDeployment = new vercel.Deployment(this, "DocsDeployment", {
      projectId: docsProject.id,
      //@ts-ignore
      files: docsProjectDirectory.files,
      pathPrefix: docsProjectDirectory.path,
      production: true,
    });

    new TerraformOutput(this, "FrontendUrlWeb", {
      value: webDeployment.url,
    });

    new TerraformOutput(this, "FrontendUrlDocs", {
      value: docsDeployment.url,
    });
  }
}

const app = new App();

const backend = new BackendStack(app, "backend", {
  api: {
    function: {
      entry: path.join(
        monorepoPath,
        "apps",
        "api",
        "src",
        "lambda.ts"
      ),
    },
  },
});

const frontend = new FrontendStack(app, "frontend", {
  apiUrl: backend.api.apiEndpoint,
});

frontend.addDependency(backend);

app.synth();
