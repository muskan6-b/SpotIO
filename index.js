import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import nodemailer from 'nodemailer';
import moment from 'moment';
import GoogleStrategy from 'passport-google-oauth2';
import RedisStore from "connect-redis"
import { createClient } from "redis"

const app = express();
const port = 3000;
const saltRounds = 10;
// let redisClient = createClient({
//   url: 'redis://red-cpppf26ehbks73c6hgrg:6379',
// });
// redisClient.connect().catch(console.error);
// let redisStore = new RedisStore({
//   client: redisClient,
//   prefix: "myapp:",
// });
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: 'localhost',
  database: 'parking_system',
  password: 'Lakshay@116',
  port: 5432,
});
db.connect();

// app.use(
//   session({
//     store: redisStore,
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: false, // if true only transmit cookie over https
//       httpOnly: false, // if true prevent client side JS from reading the cookie 
//       maxAge: 1000 * 60 * 10 // session max age in miliseconds
//     }
//   })
// );
app.use(
  session({
    // store: redisStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());




//get home page
app.get("/", async (req, res) => {
  res.render("main.ejs");
});
app.get("/admin", async (req, res) => {
  res.render("admin.ejs");
});

app.get("/parking", async (req, res) => {
  const parking_no = await db.query("select parking_no from parking where vehicle_no is not null");
  const pkArray = [];
  for (let i = 0; i < parking_no.rows.length; i++) {
    pkArray.push(parking_no.rows[i].parking_no);
  }
  console.log(pkArray);
  res.render("parking.ejs", {
    pkno: pkArray,
  });
});
app.get("/user", async (req, res) => {
  console.log(req.isAuthenticated());
  const check = await req.isAuthenticated();
  if (check) {
    const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
    if (data.rows[0] != undefined) {
      res.render('index.ejs', {
        getData: data,
      });
    } else {
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/contact-main", (req, res) => {
  res.render("main_contact.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});
app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});
app.get("/register", (req, res) => {
  res.render("register.ejs");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.get("/adminlogin", (req, res) => {
  res.render("adminlogin.ejs");
});
app.get("/history", async (req, res) => {
  console.log(req.isAuthenticated());
  const check = await req.isAuthenticated();
  if (check) {
    const data = await db.query("select * from history where vehicle_no is not null order by sr_no");
    if (data.rows[0] != undefined) {
      res.render('history.ejs', {
        getData: data,
      });
    } else {
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
});



//form entry allots new parkings

app.post("/allot", async (req, res) => {
  const ow_name = req.body.name.toUpperCase();
  const veh_no = req.body.vehicle_no.toUpperCase();
  const veh_name = req.body.company.toUpperCase();
  const category = req.body.category.toUpperCase();

  if (ow_name != '' && veh_no != '' && veh_name != '' && category != "") {
    if (category == "BIKE") {
      const checkEmptyParking = await db.query("select sr_no from parking where vehicle_no is null and parking_no like 'b%'");
      let empty_parkings = [];
      checkEmptyParking.rows.forEach((parking) => {
        empty_parkings.push(parking.sr_no);
      });
      empty_parkings.sort((a, b) => a - b);
      if (empty_parkings[0] != undefined) {
        const checkVehNo = await db.query("select vehicle_no from parking where vehicle_no is not null");
        let vehNos = [];
        checkVehNo.rows.forEach((vehno) => {
          vehNos.push(vehno.vehicle_no);
        });
        let count = 0;
        for (let i = 0; i < vehNos.length; i++) {
          const element = vehNos[i];
          if (element == veh_no) {
            count++;
          }
        }
        if (count == 0) {
          const year = new Date().getFullYear();
          const month = new Date().getMonth() + 1;
          const day = new Date().getDate();
          const date = String(day) + "-" + String(month) + "-" + String(year);
          const pkng_no = await db.query(
            "update parking set owner_name=$1,vehicle_no=$2,vehicle_company=$3,entry_date=$4 where sr_no=$5 returning parking_no",
            [ow_name, veh_no, veh_name, date, empty_parkings[0]]
          );
          let strm = "Parking " + String(pkng_no.rows[0].parking_no) + " alloted successfully";
          const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
          res.render("index.ejs", { entryMessage: strm, getData: data, });
        }
        else {
          console.log("There is same Vehicle exist");
          const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
          res.render("index.ejs", { entryMessage: "There is same vehicle exist.", getData: data, });
        }
      }
      else {
        console.log("There is no Parking Available")
        const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
        res.render("index.ejs", { entryMessage: "Parking space not available.", getData: data, });
      }
    } else if (category == "CAR") {
      const checkEmptyParking = await db.query("select sr_no from parking where vehicle_no is null and parking_no like 'c%'");
      let empty_parkings = [];
      checkEmptyParking.rows.forEach((parking) => {
        empty_parkings.push(parking.sr_no);
      });
      empty_parkings.sort((a, b) => a - b);
      if (empty_parkings[0] != undefined) {
        const checkVehNo = await db.query("select vehicle_no from parking where vehicle_no is not null");
        let vehNos = [];
        checkVehNo.rows.forEach((vehno) => {
          vehNos.push(vehno.vehicle_no);
        });
        let count = 0;
        for (let i = 0; i < vehNos.length; i++) {
          const element = vehNos[i];
          if (element == veh_no) {
            count++;
          }
        }
        if (count == 0) {
          const year = new Date().getFullYear();
          const month = new Date().getMonth() + 1;
          const day = new Date().getDate();
          const date = String(year) + "-" + String(month) + "-" + String(day);
          const pkng_no = await db.query(
            "update parking set owner_name=$1,vehicle_no=$2,vehicle_company=$3,entry_date=$4 where sr_no=$5 returning parking_no",
            [ow_name, veh_no, veh_name, date, empty_parkings[0]]
          );
          let strm = "Parking " + String(pkng_no.rows[0].parking_no) + " alloted successfully";
          const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
          res.render("index.ejs", { entryMessage: strm, getData: data, });
        }
        else {
          console.log("There is same Vehicle exist");
          const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
          res.render("index.ejs", { entryMessage: "There is same vehicle exist.", getData: data, });
        }
      }
      else {
        console.log("There is no Parking Available")
        const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
        res.render("index.ejs", { entryMessage: "Parking space not available.", getData: data, });
      }
    }
  }
  else {
    console.log("Please fill all the fields");
    const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
    if (data.rows[0] != undefined) {
      res.render("index.ejs", { entryMessage: "Please fill all fields.", getData: data, });
    }
    else {
      res.render("index.ejs", { entryMessage: "Please fill all fields.", });
    }
  }
}
);





//delete a parking
app.post("/dlt", async (req, res) => {

  const parking_no_dlt = req.body.parking_no;


  if (!parking_no_dlt) {
    return res.status(400).send("Parking number is required.");
  }

  try {
    // 1. Calculate the cost
    const data = await db.query("SELECT entry_date FROM parking WHERE parking_no = $1", [parking_no_dlt]);
    const ownerName = await db.query("SELECT owner_name FROM parking WHERE parking_no = $1", [parking_no_dlt]);
    const parkingNo = await db.query("SELECT parking_no FROM parking WHERE parking_no = $1", [parking_no_dlt]);
    const vehicleNo = await db.query("SELECT  vehicle_no from parking WHERE parking_no = $1", [parking_no_dlt]);
    const vehicleComp = await db.query("SELECT  vehicle_company from parking WHERE parking_no = $1", [parking_no_dlt]);
    const entryDat = await db.query("SELECT  entry_date from parking WHERE parking_no = $1", [parking_no_dlt]);
    const year = new Date(entryDat.rows[0].entry_date).getFullYear();
    const month = new Date(entryDat.rows[0].entry_date).getMonth() + 1;
    const day = new Date(entryDat.rows[0].entry_date).getDate();


    const date = String(day) + "-" + String(month) + "-" + String(year);
    if (parking_no_dlt == '') {
      console.log('Error');
    }
    else {
      await db.query(
        "insert into history(parking_no,owner_name,vehicle_no,vehicle_company,entry_date) values($1, $2, $3, $4,$5)",
        [parking_no_dlt, ownerName.rows[0].owner_name, vehicleNo.rows[0].vehicle_no, vehicleComp.rows[0].vehicle_company, date]
      );
      await db.query(
        "update parking set owner_name=NULL,vehicle_no=NULL,vehicle_company=NULL,entry_date=NULL where parking_no=$1",
        [parking_no_dlt]);
    }




    // if (data.rows.length === 0 || !data.rows[0].entry_date) {
    //   // You can either delete without cost or return an error
    //   // Let's assume you'll delete it regardless
    //   await db.query(
    //     "insert into history() values(parking_no = $1, owner_name = $2, vehicle_no = $3, vehicle_company = $4, entry_date = $5)",
    //     [parkingNo, ownerName, vehicleNo, vehicleComp, entryDat]
    //   );
    //   await db.query(
    //     "UPDATE parking SET owner_name=NULL, vehicle_no=NULL, vehicle_company=NULL, entry_date=NULL WHERE parking_no=$1",
    //     [parking_no_dlt]
    //   );
    //   return res.status(200).json({ message: "Parking deleted successfully (no cost calculated)." });
    // }

    const entryDate = moment(data.rows[0].entry_date);
    const now = moment();
    const durationInHours = now.diff(entryDate, 'hours');
    let cost = 0;

    if (durationInHours < 5) {
      cost = durationInHours * 100;
    } else {
      const durationInDays = now.diff(entryDate, 'days');
      cost = durationInDays * 500;
    }
    if (cost == 0) {
      cost = 100;
    }

    // 2. Perform the update (deletion) and set the calculated cost
    // await db.query(
    //   "UPDATE parking SET owner_name=NULL, vehicle_no=NULL, vehicle_company=NULL, entry_date=NULL, cost = $1 WHERE parking_no=$2",
    //   [cost, parking_no_dlt]
    // );

    console.log("Parking deleted successfully with cost calculation.");

    // Fetch updated data and re-render the page
    const datar = await db.query("select * from parking where vehicle_no is not null order by sr_no");
    if (datar.rows[0] != undefined) {
      res.render("index.ejs", { deleteMessage: `Parking deleted successfully with Cost ${cost}`, getData: datar, });
    }
    else {
      res.render("index.ejs", { deleteMessage: "Parking deleted successfully", });
    }
    // console.log(deleteMessage);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("An error occurred during deletion.");
  }



  // const parking_no_dlt = req.body.parking_no;
  // if (parking_no_dlt == '') {
  //   console.log('Error');
  // }
  // else {
  //   await db.query(
  //     "update parking set owner_name=NULL,vehicle_no=NULL,vehicle_company=NULL,entry_date=NULL where parking_no=$1",
  //     [parking_no_dlt]);
  //   console.log("parking deleted successfully.")
  //   const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
  //   if (data.rows[0] != undefined) {
  //     res.render("index.ejs", { deleteMessage: "Parking deleted successfully", getData: data, });
  //   }
  //   else {
  //     res.render("index.ejs", { deleteMessage: "Parking deleted successfully", });
  //   }
  // }
});


//edit screen
let pkno = '';
app.post("/edit", async (req, res) => {
  const parking_no_edit = req.body.parking_no;
  pkno = parking_no_edit;
  const data = await db.query("select * from parking where parking_no = $1", [parking_no_edit]);
  res.render("edit.ejs", {
    editData: data,
  });
});


app.post("/edit_enter", async (req, res) => {
  const data = await db.query("select * from parking where parking_no = $1", [pkno]);
  const ow_name = req.body.name.toUpperCase();
  const veh_no = req.body.vehicle_no.toUpperCase();
  const veh_name = req.body.company.toUpperCase();
  const checkVehNo = await db.query("select vehicle_no from parking where vehicle_no is not null");
  const popVehNo = await db.query("select vehicle_no from parking where parking_no=$1", [pkno]);
  let vehNos = [];
  checkVehNo.rows.forEach((vehno) => {
    vehNos.push(vehno.vehicle_no);
  });
  for (let i = 0; i < vehNos.length; i++) {
    if (vehNos[i] == popVehNo.rows[0].vehicle_no) {
      vehNos.splice(i, 1);
    }
  }
  let count = 0;
  for (let i = 0; i < vehNos.length; i++) {
    const element = vehNos[i];
    if (element == veh_no) {
      count++;
    }
  }
  if (count == 0) {
    await db.query("update parking set owner_name=$1,vehicle_no=$2,vehicle_company=$3 where parking_no=$4",
      [ow_name, veh_no, veh_name, pkno]
    );
    res.redirect("/user");
  }
  else if (res.status = 703) {
    res.render("edit.ejs", {
      editData: data,
      getError: "Same Vehicle exist.",
    });
  }
});

//search bar 
app.post("/search", async (req, res) => {
  const searchContent = req.body.search_box.toUpperCase();
  if (searchContent != '') {
    const getCarNoArray = await db.query("select * from parking where parking is not null")
    let CarNoArray = [];
    let PkngNoArray = [];
    getCarNoArray.rows.forEach((carno) => {
      CarNoArray.push(carno.vehicle_no);
    });
    getCarNoArray.rows.forEach((carno) => {
      PkngNoArray.push(carno.parking_no);
    });
    for (let i = 0; i < CarNoArray.length; i++) {
      const element = CarNoArray[i];
      if (searchContent == element) {
        const data = await db.query("select * from parking where vehicle_no=$1", [searchContent]);
        res.render("index.ejs", {
          getData: data,
        });
        break;
      }
    }
    for (let i = 0; i < PkngNoArray.length; i++) {
      const element = PkngNoArray[i];
      if (searchContent.toLowerCase() == element) {
        const data = await db.query("select * from parking where parking_no=$1", [searchContent.toLowerCase()]);
        res.render("index.ejs", {
          getData: data,
        });
        break;
      }
    }
  } else {
    res.redirect("/user");
  }

});

app.get("/logout", (req, res) => {
  res.render("main.ejs");
});


app.post("/contact-submit", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const text = req.body.text;
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lakshay.jangra.394@gmail.com',
      pass: 'cfaprmptfpvzdffd'
    }
  });
  var mailOptions = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: email,
    subject: '@no_reply_mail',
    html: '<h1>Thanks,<br>' + name + '<br>for contacting us, we will get back to you as soon as possible.</h1>'
  };
  var mailOptions1 = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: 'jangralakshay611@gmail.com',
    subject: 'A person contact us on Lakshay Solutions.',
    html: '<h1>Email:<br>' + email + '<br>Text:<br>' + text + '</h1>',
  };
  if (name.length != 0 && email.length != 0) {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    transporter.sendMail(mailOptions1, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    res.redirect("/contact-main");
  }
  else {
    res.send("Please fill all the fields");
  }
})
app.post("/contact-submitin", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const text = req.body.text;
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lakshay.jangra.394@gmail.com',
      pass: 'cfaprmptfpvzdffd'
    }
  });
  var mailOptions = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: email,
    subject: '@no_reply_mail',
    html: '<h1>Thanks,<br>' + name + '<br>for contacting us, we will get back to you as soon as possible.</h1>'
  };
  var mailOptions1 = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: 'jangralakshay611@gmail.com',
    subject: 'A person contact us on Lakshay Solutions.',
    html: '<h1>Email:<br>' + email + '<br>Text:<br>' + text + '</h1>',
  };
  if (name.length != 0 && email.length != 0) {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    transporter.sendMail(mailOptions1, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    res.redirect("/contact");
  }
  else {
    res.send("Please fill all the fields");
  }
})











app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/user",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/user",
    failureRedirect: "/login",
  })
);
app.post(
  "/adminlogin",
  passport.authenticate("local", {
    successRedirect: "/register",
    failureRedirect: "/adminlogin",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/login");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        await console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});


