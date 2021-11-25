import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { binary2base64 } from "rollup-plugin-binary2base64";

const production = !process.env.DEV_MODE;

export default {
    input: "src/index.js",
    output: {
        file: "dist/worker.js",
        format: "es",
        sourcemap: false,
    },
    plugins: [
        resolve(),
        commonjs(),
        binary2base64({
            include: ["src/public/**/*", "src/public/*"],
            exclude: ["src/public/static.js"],
        }),
    ],
};
