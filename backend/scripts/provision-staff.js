#!/usr/bin/env node

/**
 * UEM Admission System - Staff Provisioning CLI Tool
 *
 * Safely provisions administrator or verification officer accounts directly into MongoDB.
 * Enforces:
 *   - Strong password requirements (>= 8 characters)
 *   - Bcrypt hashing
 *   - Strict staff role validation ('admin' or 'verification_officer')
 *   - Protection against accidental account overrides unless --promote is explicitly specified.
 *
 * Usage:
 *   node scripts/provision-staff.js --name="Registrar Admin" --email="admin@uem.edu.in" --password="SuperSecretPassword123" --role="admin"
 *   node scripts/provision-staff.js --name="Jane Officer" --email="officer@uem.edu.in" --password="StrongOfficerPass123" --role="verification_officer"
 *   node scripts/provision-staff.js --name="Promoted Officer" --email="existing@uem.edu.in" --password="NewPassword123" --role="verification_officer" --promote
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

function cleanArg(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    promote: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--name=')) {
      options.name = cleanArg(arg.substring('--name='.length));
    } else if (arg === '--name' && args[i + 1]) {
      options.name = cleanArg(args[++i]);
    } else if (arg.startsWith('--email=')) {
      options.email = cleanArg(arg.substring('--email='.length));
    } else if (arg === '--email' && args[i + 1]) {
      options.email = cleanArg(args[++i]);
    } else if (arg.startsWith('--password=')) {
      options.password = cleanArg(arg.substring('--password='.length));
    } else if (arg === '--password' && args[i + 1]) {
      options.password = cleanArg(args[++i]);
    } else if (arg.startsWith('--role=')) {
      options.role = cleanArg(arg.substring('--role='.length)).toLowerCase();
    } else if (arg === '--role' && args[i + 1]) {
      options.role = cleanArg(args[++i]).toLowerCase();
    } else if (arg === '--promote') {
      options.promote = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
UEM Admission System - Staff Provisioning Script
================================================
Usage:
  node scripts/provision-staff.js --name="<Name>" --email="<Email>" --password="<Password>" --role="<admin|verification_officer>" [--promote]

Options:
  --name       Staff member's full name (minimum 2 characters)
  --email      Staff corporate email address (valid email format)
  --password   Secure password for staff account (minimum 8 characters)
  --role       Staff role: 'admin' or 'verification_officer'
  --promote    Flag to explicitly permit upgrading/re-provisioning an existing user account
`);
}

async function run() {
  const options = parseArgs();

  if (!options.name || !options.email || !options.password || !options.role) {
    console.error('Error: Missing required arguments.');
    printHelp();
    process.exit(1);
  }

  // Validate name
  if (options.name.length < 2) {
    console.error('Validation Error: Name must be at least 2 characters long.');
    process.exit(1);
  }

  // Validate email
  const normalizedEmail = options.email.toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    console.error('Validation Error: Invalid email format.');
    process.exit(1);
  }

  // Validate role
  const allowedRoles = ['admin', 'verification_officer'];
  if (!allowedRoles.includes(options.role)) {
    console.error(`Validation Error: Invalid role '${options.role}'. Staff role must be either 'admin' or 'verification_officer'.`);
    process.exit(1);
  }

  // Validate password strength
  if (options.password.length < 8) {
    console.error('Validation Error: Password must be at least 8 characters long for staff accounts.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Database Error: MONGODB_URI is not set in backend/.env.');
    process.exit(1);
  }

  try {
    const normalizedUri = mongoUri.trim().replace(/([^:])\/\/+/g, '$1/');
    await mongoose.connect(normalizedUri);
    console.log('Connected to MongoDB database.');

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (!options.promote) {
        console.error(
          `Conflict Error: An account already exists for ${normalizedEmail} with role '${existingUser.role}'.\n` +
          `If you intentionally wish to update or promote this account to '${options.role}', run again with the --promote flag.`
        );
        await mongoose.disconnect();
        process.exit(1);
      }

      console.log(`Promoting existing user (${existingUser.email}) from '${existingUser.role}' to '${options.role}'...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(options.password, saltRounds);

      existingUser.name = options.name;
      existingUser.role = options.role;
      existingUser.passwordHash = passwordHash;
      await existingUser.save();

      console.log('----------------------------------------------------');
      console.log('Staff Account Successfully Updated/Promoted:');
      console.log(`  User ID:   ${existingUser._id}`);
      console.log(`  Name:      ${existingUser.name}`);
      console.log(`  Email:     ${existingUser.email}`);
      console.log(`  Role:      ${existingUser.role}`);
      console.log('----------------------------------------------------');
    } else {
      console.log(`Creating new staff account (${options.role}) for ${normalizedEmail}...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(options.password, saltRounds);

      const newUser = await User.create({
        name: options.name,
        email: normalizedEmail,
        passwordHash,
        role: options.role
      });

      console.log('----------------------------------------------------');
      console.log('Staff Account Successfully Provisioned:');
      console.log(`  User ID:   ${newUser._id}`);
      console.log(`  Name:      ${newUser.name}`);
      console.log(`  Email:     ${newUser.email}`);
      console.log(`  Role:      ${newUser.role}`);
      console.log('----------------------------------------------------');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Provisioning Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

run();
