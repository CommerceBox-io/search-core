const path = require('path');
const p = require('./package.json');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const fileName = 'bundle.js';

module.exports = {
    entry: './src/index.js',
    output: {
        library: {
            name: "SearchCore",
            type: "umd",
            export: "default",
        },
        filename: fileName,
        path: path.resolve(__dirname, 'output', p.version),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, `output/${p.version}/${fileName}`),
                    to: path.resolve(__dirname, `output/${fileName}`),
                },
            ],
        }),
    ],
};
