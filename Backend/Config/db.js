const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI is not defined. Set MONGODB_URI in Backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'test',
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    console.error('Make sure your Atlas cluster is reachable, your IP is allowed, and the URI is correct.');
    process.exit(1);
  }
}
 
module.exports = connectDB;
