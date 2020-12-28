const  express = require('express')
const User = require('../models/user')
const auth = require('../middleware/auth')
const multer = require('multer')
const sharp = require('sharp')
const { sendWelcomeEmail, sendDeleteEmail } = require('../emails/account')

const router = new express.Router()


router.post('/users', async (req, res) => {
    const user = new User(req.body)

    try{
        sendWelcomeEmail(user.email, user.name)
        const token = await user.generateAuthToken()
        await user.save()
        res.status(201).send({ user, token })
    } catch(e) {
        res.status(400).send(e)
    }
})

router.post('/users/login', async (req, res) => {
    try{
        const user = await User.findByCredentials(req.body.email, req.body.password)
        const token = await user.generateAuthToken()
        res.send( {user, token})
    } catch (e) {
        res.status(400).send()
    }
})

router.post('/users/logout', auth, async (req, res) => {
    try{
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token
        })
        await req.user.save()
        
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.post('/users/logoutAll', auth, async (req, res) => {
    try{
        req.user.tokens = []

        await req.user.save()
        
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.get('/users/me', auth, async (req, res) => {
    res.send(req.user)
})

router.patch('/users/me', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'email', 'password', 'age']
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if(!isValidOperation){
        return res.status(400).send({error: 'Invalid updates!'})
    }

    try {
        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()

        res.send(req.user)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/users/me', auth, async (req, res) => {
    try{
        await req.user.remove()
        sendDeleteEmail(req.user.email, req.user.name)
        
        res.send(req.user)
    } catch (e) {
        res.status(500).send(e)
    }
})
const upload = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb){
        if(!file.originalname.match(/\.(jpg|jpeg|png)$/)){
            return cb(new Error('file must be jpg or jpeg or png'))
        }

        cb(undefined, true)
    }
})

router.post('/users/me/avator', auth, upload.single('avator'), async (req, res) => {

    const buffer = await sharp(req.file.buffer).resize({ width: 250, height: 250 }).png().toBuffer()

    req.user.avator = buffer
    await req.user.save()
    res.send()
}, (error, req, res, next) => {
    res.status(400).send({error: error.message})
})

router.delete('/users/me/avator', auth, async (req, res) => {
    if(req.user.avator === undefined){
        return res.send({error: 'Nothing to delete'})
    }
    req.user.avator = undefined
    await req.user.save()
    res.send()
})

router.get('/users/:id/avator', async (req, res) => {
    try{
        const user = await User.findById(req.params.id)

        if (!user || !user.avator) {
            throw new Error()
        }

        res.set('Content-Type', 'image/png')
        res.send(user.avator)
    } catch (e) {
        res.status(404).send()
    }
})

module.exports = router