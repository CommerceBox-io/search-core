# Use an official Node.js image as a base
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy only the package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Run the build command
CMD ["npm", "run", "build"]