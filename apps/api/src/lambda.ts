import "source-map-support/register";
import { configure as serverlessExpress } from "@vendia/serverless-express";
import type { Callback, Context, Handler } from "aws-lambda";
import { app } from "./app";

let server: Handler;

async function bootstrap(): Promise<Handler> {
  return serverlessExpress({ app });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  server = server ?? (await bootstrap());
  return server(event, context, callback);
};
