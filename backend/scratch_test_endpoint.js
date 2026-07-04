const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || "VRGhaU2niVXi4SaeIYNQRT0BjPSqQYsQg0t//4bGDCt6NmJ43l2+6nEMZ5fMzNUU5lqv00zZBiHSUus+CxGmVw==";

// Generate test token
const token = jwt.sign(
  {
    role: "authenticated",
    sub: "member_51",
    userId: 51,
    userType: "member",
    email: "veena@example.com",
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

console.log('Generated JWT Token for testing.');

const payload = JSON.stringify({
  referenceType: "post",
  referenceId: "176"
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/notifications/read',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  console.log(`Response Status: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', data);
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error);
});

req.write(payload);
req.end();
