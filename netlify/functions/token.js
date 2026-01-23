/**
 * Netlify Function: CKEditor Token Endpoint
 * 
 * Generates JWT tokens for CKEditor Cloud Services
 * 
 * Required environment variables (set in Netlify Dashboard):
 * - CK_ENVIRONMENT_ID: Your CKEditor environment ID
 * - CK_ACCESS_KEY: Your CKEditor access key (secret for signing)
 */

const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'text/plain'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Get environment variables
        const environmentId = process.env.CK_ENVIRONMENT_ID;
        const accessKey = process.env.CK_ACCESS_KEY;

        if (!environmentId || !accessKey) {
            console.error('Missing environment variables');
            return {
                statusCode: 500,
                headers,
                body: 'Server configuration error'
            };
        }

        // Get user info from query params or body
        let userId = 'anonymous';
        let userName = 'Anonymous User';
        let userEmail = '';

        // Try to get from query params first
        if (event.queryStringParameters) {
            userId = event.queryStringParameters.userId || userId;
            userName = event.queryStringParameters.userName || userName;
            userEmail = event.queryStringParameters.userEmail || userEmail;
        }

        // Or from POST body
        if (event.httpMethod === 'POST' && event.body) {
            try {
                const body = JSON.parse(event.body);
                userId = body.userId || userId;
                userName = body.userName || userName;
                userEmail = body.userEmail || userEmail;
            } catch (e) {
                // Ignore JSON parse errors, use defaults
            }
        }

        // Build the token payload
        const payload = {
            aud: environmentId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
            sub: userId,
            user: {
                id: userId,
                name: userName,
                ...(userEmail && { email: userEmail })
            },
            auth: {
                collaboration: {
                    '*': {
                        role: 'writer'
                    }
                },
                ai: {
                    permissions: [
                        'ai:admin'
                    ]
                }
            }
        };

        // Sign the token
        const token = jwt.sign(payload, accessKey, {
            algorithm: 'HS256'
        });

        console.log(`Token generated for user: ${userId}, env: ${environmentId}`);
        console.log('Token payload:', JSON.stringify(payload, null, 2));

        return {
            statusCode: 200,
            headers,
            body: token
        };

    } catch (error) {
        console.error('Token generation error:', error);
        return {
            statusCode: 500,
            headers,
            body: 'Token generation failed'
        };
    }
};