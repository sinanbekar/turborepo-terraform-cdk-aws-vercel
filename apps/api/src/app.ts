import cors from "cors"
import express, { Request, Response } from "express";
import { getCurrentInvoke } from "@vendia/serverless-express";

const app = express();

const router = express.Router();

router.use(cors());
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.get("/", (req: Request, res: Response) => {
  const isServerlessExecution = Boolean(
    getCurrentInvoke().event ?? null
  );
  return res.json({
    data: `Hello World${isServerlessExecution ? " From Serverless" : ""}!`,
    isServerlessExecution
  });
});

app.use("/", router);

export { app };
