const express = require('express');
const moongoose = require('mongoose');

const userSchema = new moongoose.Schema({
  githubId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  avatar : {
    type: String,
    required: true, 
  },
  accessToken : {
    type : String,
    required : true
  }
},{timestamps: true});

const User = moongoose.model('User', userSchema);

module.exports = User;