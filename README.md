# NIECE
## Node.js Inline-Edited-Content & Express

### Install

Assuming that you have <a href="https://nodejs.org/en/download/package-manager/">installed node.js</a>.

Site in under a minute using terminal:

1. Build your node app: `npm init`
2. Insall nodemon to help with development: `npm install -g nodemon`
3. Install NIECE `npm install niece`
4. Open, your app's package.json file and add this to the "scripts": ```"dev": "nodemon index.js"``` (assuming your app's main file is index.js)
5. Run your app: `npm run dev` which will build the site and listen at port 4430. Your site will be http://localhost:4430/
6. Go to http://localhost:4430/user/register and create your admin account.

### Thats it!
