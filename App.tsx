import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDb6OJqRdUtdq6Ptm7oCQ7Eq_NJ0FAl1fw",
  authDomain: "coffeebeanrewards.firebaseapp.com",
  projectId: "coffeebeanrewards",
  storageBucket: "coffeebeanrewards.firebasestorage.app",
  messagingSenderId: "614060117359",
  appId: "1:614060117359:web:852ee8932e210cdf976c9a",
  measurementId: "G-KF5ZYRE58B"
}
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [classes, setClasses] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState([]);

  // Fetch data from Firestore
  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(
        currentUser
          ? {
              ...currentUser,
              role: currentUser.email.includes("teacher")
                ? "teacher"
                : "student",
            }
          : null
      );
    });

    const fetchData = async () => {
      const classesSnapshot = await getDocs(collection(db, "classes"));
      setClasses(
        classesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      const rewardsSnapshot = await getDocs(collection(db, "rewards"));
      setRewards(
        rewardsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(
        usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    };
    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <header className="bg-amber-600 text-white p-4 rounded-lg mb-4 flex items-center">
        <img
          src="https://via.placeholder.com/50?text=☕"
          alt="Coffee Logo"
          className="mr-4"
        />
        <h1 className="text-3xl font-bold">Coffee Bean Rewards</h1>
      </header>
      {user ? (
        user.role === "teacher" ? (
          <TeacherDashboard
            user={user}
            setUser={setUser}
            classes={classes}
            setClasses={setClasses}
            users={users}
            setUsers={setUsers}
            rewards={rewards}
            setRewards={setRewards}
            db={db}
          />
        ) : (
          <StudentDashboard
            user={user}
            setUser={setUser}
            classes={classes}
            rewards={rewards}
            users={users}
          />
        )
      ) : (
        <AuthForm
          isLogin={isLogin}
          setIsLogin={setIsLogin}
          setUser={setUser}
          auth={auth}
          db={db}
        />
      )}
    </div>
  );
}

// Authentication Form
function AuthForm({ isLogin, setIsLogin, setUser, auth, db }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [learningCoachEmail, setLearningCoachEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        setUser({
          ...userCredential.user,
          role: email.includes("teacher") ? "teacher" : "student",
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await addDoc(collection(db, "users"), {
          email,
          firstName,
          lastName,
          role: email.includes("teacher") ? "teacher" : "student",
          learningCoachEmail: email.includes("teacher")
            ? ""
            : learningCoachEmail,
          beans: 0,
          classId: null,
        });
        setUser({
          ...userCredential.user,
          role: email.includes("teacher") ? "teacher" : "student",
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-amber-800">
        {isLogin ? "Login" : "Sign Up"}
      </h2>
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email (use 'teacher' in email for teacher role)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        {!isLogin && (
          <>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full p-2 border rounded"
            />
            {!email.includes("teacher") && (
              <input
                type="email"
                placeholder="Learning Coach Email"
                value={learningCoachEmail}
                onChange={(e) => setLearningCoachEmail(e.target.value)}
                className="w-full p-2 border rounded"
              />
            )}
          </>
        )}
        <button
          onClick={handleSubmit}
          className="w-full bg-amber-600 text-white p-2 rounded hover:bg-amber-700"
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>
        {error && <p className="text-red-500">{error}</p>}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-amber-600 underline"
        >
          {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
        </button>
      </div>
    </div>
  );
}

// Teacher Dashboard
function TeacherDashboard({
  user,
  setUser,
  classes,
  setClasses,
  users,
  setUsers,
  rewards,
  setRewards,
  db,
}) {
  const [className, setClassName] = useState("");
  const [classColor, setClassColor] = useState("bg-blue-200");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [learningCoachEmail, setLearningCoachEmail] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [rewardName, setRewardName] = useState("");
  const [rewardCost, setRewardCost] = useState("");

  const addClass = async () => {
    if (className) {
      const newClass = {
        name: className,
        color: classColor,
        studentIds: [],
        teacherId: user.uid,
      };
      const docRef = await addDoc(collection(db, "classes"), newClass);
      setClasses([...classes, { id: docRef.id, ...newClass }]);
      setClassName("");
    }
  };

  const addStudent = async () => {
    if (studentEmail && selectedClassId) {
      const newStudent = {
        email: studentEmail,
        firstName: studentFirstName,
        lastName: studentLastName,
        learningCoachEmail,
        role: "student",
        beans: 0,
        classId: selectedClassId,
      };
      const docRef = await addDoc(collection(db, "users"), newStudent);
      setUsers([...users, { id: docRef.id, ...newStudent }]);
      setClasses(
        classes.map((c) =>
          c.id === selectedClassId
            ? { ...c, studentIds: [...c.studentIds, docRef.id] }
            : c
        )
      );
      setStudentEmail("");
      setStudentFirstName("");
      setStudentLastName("");
      setLearningCoachEmail("");
    }
  };

  const addReward = async () => {
    if (rewardName && rewardCost) {
      const newReward = {
        name: rewardName,
        cost: parseInt(rewardCost),
        teacherId: user.uid,
      };
      const docRef = await addDoc(collection(db, "rewards"), newReward);
      setRewards([...rewards, { id: docRef.id, ...newReward }]);
      setRewardName("");
      setRewardCost("");
    }
  };

  const awardBeans = async (studentId, beans) => {
    const studentRef = doc(db, "users", studentId);
    const student = users.find((u) => u.id === studentId);
    await updateDoc(studentRef, { beans: student.beans + beans });
    setUsers(
      users.map((u) =>
        u.id === studentId ? { ...u, beans: u.beans + beans } : u
      )
    );
    // Simulate email notification (requires backend)
    console.log(`Email: Awarded ${beans} beans to ${student.firstName}`);
  };

  const scheduleWeeklyEmails = () => {
    // Simulate scheduling (requires backend Cloud Function)
    console.log("Scheduled weekly emails for updates and top earners");
  };

  const getClassRankings = (classId) => {
    return users
      .filter((u) => u.classId === classId && u.role === "student")
      .sort((a, b) => b.beans - a.beans);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold text-amber-800">Teacher Dashboard</h2>
        <button
          onClick={() => signOut(auth).then(() => setUser(null))}
          className="bg-red-500 text-white p-2 rounded"
        >
          Logout
        </button>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">
          Manage Classes
        </h3>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            placeholder="Class Name"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="p-2 border rounded"
          />
          <select
            value={classColor}
            onChange={(e) => setClassColor(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="bg-blue-200">Blue</option>
            <option value="bg-green-200">Green</option>
            <option value="bg-red-200">Red</option>
            <option value="bg-yellow-200">Yellow</option>
          </select>
          <button
            onClick={addClass}
            className="bg-amber-600 text-white p-2 rounded hover:bg-amber-700"
          >
            Add Class
          </button>
        </div>
        <div className="space-y-2">
          {classes
            .filter((c) => c.teacherId === user.uid)
            .map((c) => (
              <div key={c.id} className={`${c.color} p-2 rounded`}>
                <h4 className="font-bold">{c.name}</h4>
                <p>Students: {c.studentIds.length}</p>
                <h5 className="font-semibold mt-2">Rankings:</h5>
                <ul>
                  {getClassRankings(c.id).map((s, index) => (
                    <li key={s.id}>
                      {index + 1}. {s.firstName} {s.lastName} - {s.beans} Beans
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">Add Student</h3>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            placeholder="First Name"
            value={studentFirstName}
            onChange={(e) => setStudentFirstName(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={studentLastName}
            onChange={(e) => setStudentLastName(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="email"
            placeholder="Student Email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="email"
            placeholder="Learning Coach Email"
            value={learningCoachEmail}
            onChange={(e) => setLearningCoachEmail(e.target.value)}
            className="p-2 border rounded"
          />
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Select Class</option>
            {classes
              .filter((c) => c.teacherId === user.uid)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button
            onClick={addStudent}
            className="bg-amber-600 text-white p-2 rounded hover:bg-amber-700"
          >
            Add Student
          </button>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">
          Manage Rewards
        </h3>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            placeholder="Reward Name"
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Cost (Beans)"
            value={rewardCost}
            onChange={(e) => setRewardCost(e.target.value)}
            className="p-2 border rounded"
          />
          <button
            onClick={addReward}
            className="bg-amber-600 text-white p-2 rounded hover:bg-amber-700"
          >
            Add Reward
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {rewards
            .filter((r) => r.teacherId === user.uid)
            .map((r) => (
              <div key={r.id} className="bg-amber-100 p-2 rounded">
                <p>
                  {r.name} - {r.cost} Beans
                </p>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">Award Beans</h3>
        {classes
          .filter((c) => c.teacherId === user.uid)
          .map((c) => (
            <div key={c.id} className="mb-4">
              <h4 className="font-bold">{c.name}</h4>
              {users
                .filter((u) => c.studentIds.includes(u.id))
                .map((s) => (
                  <div key={s.id} className="flex space-x-2">
                    <p>
                      {s.firstName} {s.lastName} ({s.beans} Beans)
                    </p>
                    <button
                      onClick={() => awardBeans(s.id, 5)}
                      className="bg-green-500 text-white p-1 rounded"
                    >
                      +5 Beans
                    </button>
                  </div>
                ))}
            </div>
          ))}
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">
          Schedule Weekly Emails
        </h3>
        <button
          onClick={scheduleWeeklyEmails}
          className="bg-amber-600 text-white p-2 rounded hover:bg-amber-700"
        >
          Schedule Emails
        </button>
      </div>
    </div>
  );
}

// Student Dashboard
function StudentDashboard({ user, setUser, classes, rewards, users }) {
  const purchaseReward = async (reward) => {
    const userDoc = doc(
      db,
      "users",
      users.find((u) => u.email === user.email).id
    );
    const userData = users.find((u) => u.email === user.email);
    if (userData.beans >= reward.cost) {
      await updateDoc(userDoc, { beans: userData.beans - reward.cost });
      setUsers(
        users.map((u) =>
          u.email === user.email ? { ...u, beans: u.beans - reward.cost } : u
        )
      );
      console.log(`Email: Purchased ${reward.name} for ${reward.cost} beans`);
    } else {
      alert("Not enough beans!");
    }
  };

  const userClass = classes.find(
    (c) => c.id === users.find((u) => u.email === user.email)?.classId
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold text-amber-800">Student Dashboard</h2>
        <button
          onClick={() => signOut(auth).then(() => setUser(null))}
          className="bg-red-500 text-white p-2 rounded"
        >
          Logout
        </button>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">Profile</h3>
        <p>
          Name: {users.find((u) => u.email === user.email)?.firstName}{" "}
          {users.find((u) => u.email === user.email)?.lastName}
        </p>
        <p>Class: {userClass?.name}</p>
        <p>Beans: {users.find((u) => u.email === user.email)?.beans}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">Reward Store</h3>
        <div className="grid grid-cols-2 gap-4">
          {rewards
            .filter(
              (r) =>
                r.teacherId ===
                classes.find(
                  (c) =>
                    c.id === users.find((u) => u.email === user.email)?.classId
                )?.teacherId
            )
            .map((r) => (
              <div key={r.id} className="bg-amber-100 p-2 rounded">
                <p>
                  {r.name} - {r.cost} Beans
                </p>
                <button
                  onClick={() => purchaseReward(r)}
                  className="bg-amber-600 text-white p-1 rounded hover:bg-amber-700"
                >
                  Purchase
                </button>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-2 text-amber-800">
          Class Rankings
        </h3>
        <ul>
          {users
            .filter(
              (u) =>
                u.classId ===
                  users.find((u) => u.email === user.email)?.classId &&
                u.role === "student"
            )
            .sort((a, b) => b.beans - a.beans)
            .map((s, index) => (
              <li key={s.id}>
                {index + 1}. {s.firstName} {s.lastName} - {s.beans} Beans
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
