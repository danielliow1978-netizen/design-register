import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import projectsRouter from './routes/projects'
import drawingsRouter from './routes/drawings'
import draftsRouter from './routes/drafts'
import auditRouter from './routes/audit'
import recycleRouter from './routes/recycle'
import dashboardRouter from './routes/dashboard'
import { initCronJobs } from './services/digestScheduler'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/drawings', drawingsRouter)
app.use('/api/drafts', draftsRouter)
app.use('/api/audit', auditRouter)
app.use('/api/recycle', recycleRouter)
app.use('/api/dashboard', dashboardRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Design Register API running on port ${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    initCronJobs()
  }
})

export default app
