const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs').promises;
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

let users = [];
let rewards = [];
let purchases = [];
let classes = [];
let emailSchedules = [];

const loadData = async () => {
  try {
    users = JSON.parse(await fs.readFile('users.json'));
    rewards = JSON.parse(await fs.readFile('rewards.json'));
    purchases = JSON.parse(await fs.readFile('purchases.json'));
    classes = JSON.parse(await fs.readFile('classes.json'));
    emailSchedules = JSON.parse(await fs.readFile('emailSchedules.json'));
  } catch (e) {
    users = [];
    rewards = [];
    purchases = [];
    classes = [];
    emailSchedules = [];
  }
};

const saveData = async () => {
  await fs.writeFile('users.json', JSON.stringify(users));
  await fs.writeFile('rewards.json', JSON.stringify(rewards));
  await fs.writeFile('purchases.json', JSON.stringify(purchases));
  await fs.writeFile('classes.json', JSON.stringify(classes));
  await fs.writeFile('emailSchedules.json', JSON.stringify(emailSchedules));
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

const sendWeeklyEmails = async (classId) => {
  const cls = classes.find(c => c.id === parseInt(classId));
  const classStudents = users.filter(u => u.classId === parseInt(classId) && u.role === 'student');
  const teacher = users.find(u => u.role === 'teacher');
  const weekPurchases = purchases.filter(p => {
    const purchaseDate = new Date(p.date);
    const now = new Date();
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
    return purchaseDate >= oneWeekAgo;
  });

  for (const student of classStudents) {
    const studentPurchases = weekPurchases
      .filter(p => p.userId === student.id)
      .map(p => {
        const reward = rewards.find(r => r.id === p.rewardId);
        return `${reward.name} (${reward.cost} beans)`;
      });
    const earnedPoints = student.points || 0;
    const emailContent = `
      Weekly Update for ${student.name} in ${cls.name}:
      Beans Earned: ${earnedPoints}
      Purchases: ${studentPurchases.length > 0 ? studentPurchases.join(', ') : 'None'}
    `;
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: `${student.email},${student.learningCoachEmail}`,
      subject: `Weekly Update for ${student.name}`,
      text: emailContent
    });
  }

  const topStudents = classStudents
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 3);
  for (const student of topStudents) {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: student.email,
      subject: `Congratulations, Top Bean Earner in ${cls.name}!`,
      text: `Great job, ${student.name}! You're one of the top 3 bean earners in ${cls.name} with ${student.points || 0} beans!`
    });
  }
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/signup', async (req, res) => {
  const { email, firstName, lastName, password, role } = req.body;
  if (users.find(u => u.email === email)) {
    res.json({ success: false });
  } else {
    const user = { id: users.length + 1, email, firstName, lastName, password, role, points: 0, name: `${firstName} ${lastName}` };
    users.push(user);
    await saveData();
    res.json({ success: true });
  }
});

app.get('/api/students', async (req, res) => {
  res.json(users.filter(u => u.role === 'student'));
});

app.get('/api/rewards', async (req, res) => {
  res.json(rewards);
});

app.get('/api/classes', async (req, res) => {
  res.json(classes);
});

app.post('/api/students', async (req, res) => {
  const { firstName, lastName, email, password, learningCoachEmail } = req.body;
  if (users.find(u => u.email === email)) {
    res.json({ success: false });
  } else {
    const user = {
      id: users.length + 1,
      email,
      firstName,
      lastName,
      password,
      role: 'student',
      points: 0,
      name: `${firstName} ${lastName}`,
      learningCoachEmail
    };
    users.push(user);
    await saveData();
    res.json({ success: true });
  }
});

app.post('/api/award', async (req, res) => {
  const { studentId, points } = req.body;
  const student = users.find(u => u.id === parseInt(studentId));
  if (student) {
    student.points = (student.points || 0) + parseInt(points);
    await saveData();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/rewards', async (req, res) => {
  const { name, cost } = req.body;
  rewards.push({ id: rewards.length + 1, name, cost: parseInt(cost) });
  await saveData();
  res.json({ success: true });
});

app.post('/api/redeem', async (req, res) => {
  const { userId, rewardId } = req.body;
  const user = users.find(u => u.id === parseInt(userId));
  const reward = rewards.find(r => r.id === parseInt(rewardId));
  if (user && reward && user.points >= reward.cost) {
    user.points -= reward.cost;
    purchases.push({ userId, rewardId, date: new Date() });
    await saveData();
    const teacher = users.find(u => u.role === 'teacher');
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: teacher.email,
      subject: 'Reward Redeemed',
      text: `${user.name} redeemed ${reward.name} for ${reward.cost} beans.`
    });
    res.json({ success: true, newPoints: user.points });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/classes', async (req, res) => {
  const { name, color } = req.body;
  classes.push({ id: classes.length + 1, name, color });
  await saveData();
  res.json({ success: true });
});

app.post('/api/assign-class', async (req, res) => {
  const { studentId, classId } = req.body;
  const student = users.find(u => u.id === parseInt(studentId));
  if (student) {
    student.classId = parseInt(classId);
    await saveData();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/schedule-emails', async (req, res) => {
  const { classId, day, time } = req.body;
  const days = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0 };
  const [hour, minute] = time.split(':');
  const cronTime = `${minute} ${hour} * * ${days[day]}`;
  emailSchedules.push({ classId, cronTime });
  cron.schedule(cronTime, () => sendWeeklyEmails(classId));
  await saveData();
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  loadData();
  emailSchedules.forEach(schedule => {
    cron.schedule(schedule.cronTime, () => sendWeeklyEmails(schedule.classId));
  });
});
