import dotenv from "dotenv";
import path from "path";

const backendEnvPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
