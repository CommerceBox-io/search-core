const path = require('path');
const p = require('./package.json');
const fs = require('fs');

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
        {
            apply: (compiler) => {
                compiler.hooks.afterEmit.tap('CopyFilePlugin', (compilation) => {
                    const from = path.resolve(__dirname, `output/${p.version}/${fileName}`);
                    const to = path.resolve(__dirname, `output/${fileName}`);

                    fs.copyFileSync(from, to);
                    console.log(`Copied ${from} to ${to}`);
                });
            }
        }
    ],
};
