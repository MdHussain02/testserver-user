const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For generating JWT tokens

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const mongoURI = 'mongodb://localhost:27017/loginApp'; // Replace with your MongoDB URI
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Mongoose Schema and Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  financeData: [{
    month: { type: String, required: true },
    income: { type: Number, required: true },
    expenses: { type: Number, required: true },
    savings: { type: Number, required: true }
  }]
});

const User = mongoose.model('User', userSchema);

// JWT Secret (use a stronger secret in production)
const JWT_SECRET = 'your_jwt_secret_key';

// **Signup Route**
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Check if the username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// **Login Route**
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    // Return the token to the client
    res.status(200).json({ message: 'Login successful!', token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// **Post Monthly Finance Data**
app.post('/add-finance', async (req, res) => {
  const { username, month, income, expenses, savings } = req.body;

  if (!username || !month || income === undefined || expenses === undefined) {
    return res.status(400).json({ error: 'All fields are required except savings.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    // Check if the finance data for the given month already exists
    const existingData = user.financeData.find(data => data.month === month);
    if (existingData) {
      return res.status(400).json({ error: 'Data for this month already exists.' });
    }

    // If savings is 0, calculate savings as income - expenses
    let calculatedSavings = savings;

    if (savings === 0 || savings === undefined) {
      calculatedSavings = income - expenses;
    }

    // Add the new finance data to the user's financeData array
    user.financeData.push({ month, income, expenses, savings: calculatedSavings });
    await user.save();

    res.status(201).json({ message: 'Finance data added successfully!' });
  } catch (error) {
    console.error('Error saving finance data:', error);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// **Get Finance Data**
app.get('/getfinancedata', async (req, res) => {
  const { username } = req.query; // Get username from query parameter

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    res.status(200).json(user.financeData); // Return finance data
  } catch (error) {
    console.error('Error fetching finance data:', error);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// **Update Finance Data**
app.put('/update-finance', async (req, res) => {
  const { username, month, income, expenses, savings } = req.body;

  if (!username || !month || income === undefined || expenses === undefined) {
    return res.status(400).json({ error: 'All fields are required except savings.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const financeData = user.financeData.find((data) => data.month === month);
    if (!financeData) {
      return res.status(400).json({ error: 'Data for this month not found.' });
    }

    // Recalculate savings if income or expenses have changed
    let updatedSavings = savings;

    if (savings === 0 || savings === undefined) {
      updatedSavings = income - expenses;
    }

    // If either income or expenses has changed, recalculate savings
    if (financeData.income !== income || financeData.expenses !== expenses) {
      updatedSavings = income - expenses;
    }

    // Update the finance data
    financeData.income = income;
    financeData.expenses = expenses;
    financeData.savings = updatedSavings;

    await user.save();
    res.status(200).json({ message: 'Finance data updated successfully!' });
  } catch (error) {
    console.error('Error updating finance data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// **Delete Finance Data**
app.delete('/delete-finance', async (req, res) => {
  const { username, month } = req.body;

  if (!username || !month) {
    return res.status(400).json({ error: 'Username and month are required.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    user.financeData = user.financeData.filter((data) => data.month !== month);
    await user.save();
    res.status(200).json({ message: 'Finance data deleted successfully!' });
  } catch (error) {
    console.error('Error deleting finance data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)); 
