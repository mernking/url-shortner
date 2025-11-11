const prisma = require('../prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const API_KEY_PREFIX = 'ak_';

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: mysecretpassword
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: User registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *       400:
 *         description: Invalid input or user creation failed.
 */
async function signup(req, res) {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
    });
    return res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    return res.status(400).json({ error: 'User creation failed', details: err.message });
  }
}

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a user and get a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: mysecretpassword
 *     responses:
 *       200:
 *         description: User logged in successfully, returns JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token.
 *       401:
 *         description: Invalid credentials.
 */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({ token });
}

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Create a new API key for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Optional name for the API key.
 *                 example: My Marketing Key
 *               dailyLimit:
 *                 type: integer
 *                 description: Optional daily usage limit for the API key.
 *                 example: 1000
 *     responses:
 *       200:
 *         description: API key created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   description: The generated API key.
 *                 id:
 *                   type: integer
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized, JWT token missing or invalid.
 */
// create API key for logged-in user
async function createApiKey(req, res) {
  const { name, dailyLimit } = req.body;
  const userId = req.user.userId; // from jwtAuth middleware

  const key = API_KEY_PREFIX + uuidv4().replace(/\-/g, '');
  const apiKey = await prisma.apiKey.create({
    data: {
      key,
      name,
      userId,
      dailyLimit: dailyLimit || null,
    },
  });

  return res.json({ apiKey: apiKey.key, id: apiKey.id, createdAt: apiKey.createdAt });
}

module.exports = { signup, login, createApiKey };