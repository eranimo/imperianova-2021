const path = require("path");
var HtmlWebpackPlugin = require("html-webpack-plugin");
var webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  entry: {
    main: "./src/index.tsx",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        include: /src/,
        options: {
          transpileOnly: true,
          experimentalWatchApi: true,
          compilerOptions: {
            module: 'esnext',
          }
        },
      },
      {
        test: /\.worker\.(c|m)?js$/i,
        loader: "worker-loader",
        options: {
          filename: "[name].[contenthash].worker.js",
        },
      },
      {
        test: /\.xml$/,
        use: ['xml-loader']
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        type: 'asset/inline'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: ["file-loader"],
      },
      {
        test: /\.json$/,
        type: 'asset/resource'
      }
    ],
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    runtimeChunk: "single",
    moduleIds: "deterministic",
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  devtool: "source-map",
  output: {
    filename: "[name].bundle.js",
    chunkFilename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    pathinfo: false,
    globalObject: 'self'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
    new ForkTsCheckerWebpackPlugin(),
  ],
  devServer: {
    compress: true,
    historyApiFallback: true,
  },
};
