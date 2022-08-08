# Turborepo example Terraform CDK infrastructure with AWS and Vercel deployments

This is an official starter turborepo.

## What's inside?

This turborepo uses [pnpm](https://pnpm.io) as a packages manager. It includes the following packages/apps:

### Apps and Packages
- `api`: a Lambda function
- `docs`: a [Next.js](https://nextjs.org) app
- `web`: another [Next.js](https://nextjs.org) app
- `ui`: a stub React component library shared by both `web` and `docs` applications
- `eslint-config-custom`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `tsconfig`: `tsconfig.json`s used throughout the monorepo

### Utilities

This turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

## Setup

```bash
git clone https://github.com/sinanbekar/turborepo-terraform-cdk-aws-vercel
cd turborepo-terraform-cdk-aws-vercel
pnpm install
```

### Build

To build all apps and packages, run the following command:

```bash
pnpm run build
```

### Deployment

To deploy frontend to Vercel, backend to AWS (Lambda), first install cdktf-cli:

```bash
pnpm add --global cdktf-cli@latest
cd infrastructure/cdktf
cdktf get # generate constructs from hcl providers
```
Please make sure that set up these environment variables: `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` and `VERCEL_API_TOKEN`

and deploy 🚀

```bash
cdktf deploy backend frontend
```

### Develop

To develop all apps and packages, run the following command:

```bash
pnpm run dev
```

## Useful Links

Learn more about Terraform and CDK for Terraform:
- [Official Guide Vercel and Terraform (HCL)](https://vercel.com/guides/integrating-terraform-with-vercel)
- [CDKTF Docs](https://www.terraform.io/cdktf)

Learn more about the power of Turborepo:

- [Pipelines](https://turborepo.org/docs/core-concepts/pipelines)
- [Caching](https://turborepo.org/docs/core-concepts/caching)
- [Remote Caching](https://turborepo.org/docs/core-concepts/remote-caching)
- [Scoped Tasks](https://turborepo.org/docs/core-concepts/scopes)
- [Configuration Options](https://turborepo.org/docs/reference/configuration)
- [CLI Usage](https://turborepo.org/docs/reference/command-line-reference)
