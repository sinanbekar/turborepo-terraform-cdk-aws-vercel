import { app } from "./app";

const port = process.env.PORT || 3000;

async function bootstrap() {
  app.listen(port, () => {
    console.log(`API running on ${port}`);
  });
}

bootstrap();
