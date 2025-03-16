import { buildRssFeed } from './daverss.js'
import { server, getReturnText } from 'davexmlrpc'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = new Hono()

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/', (c) => c.text('GET or POST to /feed?key=userkey'))

serve(app)

var headElements = { 
	"title": "RSS GroupChat Extension example feed",
	"description": "Just an example of a server that supports the RSS GroupChat Extension.",
	"language": "en-us",
	"generator": "rss-groupchat-server v1.0",
	"maxFeedItems": 25,
	"rssCloudDomain": "localhost:3000",
	"rssCloudPort": 5337,
	"rssCloudPath": "/pleaseNotify",
	"rssCloudRegisterProcedure": "",
	"rssCloudProtocol": "http-post"
	};

// Load messages from JSON file
let historyArray;
try {
    const messagesPath = path.join(__dirname, 'messages.json');
    const messagesData = fs.readFileSync(messagesPath, 'utf-8');
    historyArray = JSON.parse(messagesData); // Now directly using the array from messages.json
} catch (error) {
    console.error('Error loading messages.json:', error);
    historyArray = [];
}

var xmltext = buildRssFeed(headElements, historyArray); //generate the RSS feed from the data



app.get('/feed', (c) => {
    const key = c.req.query('key');
    
    if (!key) {
        return c.text('Authentication Required - Missing API key', 401);
    }
    
    if (key !== 'userkey') {
        return c.text('Invalid API key', 403);
    }
    
    return c.text(xmltext)
})

app.post('/feed', async (c) => {
    const key = c.req.query('key');
    const text = await c.req.text()
    
    if (!key) {
        return c.text('Authentication Required - Missing API key', 401);
    }
    
    if (key !== 'userkey') {
        return c.text('Invalid API key', 403);
    }

    // Parse the XML-RPC payload
    return new Promise((resolve) => {
        server(text, (err, verb, params) => {
            if (err) {
                console.error('XML-RPC parsing error:', err);
                resolve(c.text('XML-RPC parsing error', 400));
                return;
            }
            
            // The struct with title and categories is the 4th parameter (index 3)
            const postData = params[3];
            const title = postData.title;
            const firstCategory = postData.categories?.[0];
            
            console.log('Title:', title);
            console.log('First Category:', firstCategory);

            // Check if category matches
            if (firstCategory === 'group123') {
                // Create new message object
                const newMessage = {
                    title: title,
                    when: new Date().toISOString(),
                    author: "friend@example.com",
                    groupchat: {
                        group: {
                            id: "group123",
                            url: "http://localhost:3000/feed?key=userkey",
                            title: "Social Web Chat Group"
                        }
                    }
                };

                // Append to history array
                historyArray.push(newMessage);

                // Save updated array to disk
                try {
                    const messagesPath = path.join(__dirname, 'messages.json');
                    fs.writeFileSync(messagesPath, JSON.stringify(historyArray, null, 4));
                    console.log('Successfully saved new message to messages.json');
                    
                    // Regenerate the RSS feed with updated messages
                    xmltext = buildRssFeed(headElements, historyArray);
                } catch (error) {
                    console.error('Error saving messages.json:', error);
                }
            }

            // Return a valid XML-RPC response
            const responseXml = getReturnText("1"); // Return post ID "1" as success
            resolve(c.text(responseXml, 200, {
                'Content-Type': 'text/xml'
            }));
        });
    });
});