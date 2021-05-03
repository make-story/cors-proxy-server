/**
 * https://www.twilio.com/blog/node-js-proxy-server
 */
const express = require('express');
const morgan = require("morgan");
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

// Create Express Server
const app = express();
app.use(cors());

// Configuration
const PORT = 4000;
const HOST = "localhost";
const API_SERVICE_URL = "https://jsonplaceholder.typicode.com";

// Logging
app.use(morgan('dev'));

// Authorization
// curl -H "Authorization: nikolay" localhost:3000/api/posts/1
// curl -X POST -H "Authorization: real_user" --data '{"title": "Build a Node.js Proxy Server in Under 10 minutes!","body": "We have all heard the term "proxy"...",userId="1"}' localhost:3000/api/posts
/*app.use('', (request, response, next) => {
    if (request.headers.authorization) {
        next();
    } else {
        response.sendStatus(403);
    }
 });*/

 // Proxy endpoints
 // curl localhost:3000/api/posts/1
app.use('/api', createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        [`^/api`]: '',
    },
}));

// Start the Proxy
app.listen(PORT, HOST, () => {
    console.log(`Starting Proxy at ${HOST}:${PORT}`);
});