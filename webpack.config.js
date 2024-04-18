const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        library: {
            name: "SearchCore",
            type: "umd",
            export: "default",
        },
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'output'),
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
};
