var express             = require("express"),
    app                 = express(),
    http                = require("http").Server(app),
    io                  = require("socket.io")(http),
    mustacheExpress     = require("mustache-express"),
    strip               = require("strip"),
    bbcode              = require("bbcode").parse,
    _                   = require("lodash");

// Serve public files
app.use("/", express.static(__dirname + "/public"));
app.use("/bc", express.static(__dirname + "/bower_components"));

// Setup Mustache
app.engine("html", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", __dirname + "/views");

// Send index page
app.get("/", function(req, res) {
    res.render("index.html");
});

var channels = [
    {
        name: "initial",
        users: []
    },
    {
        name: "room 1",
        users: []
    },
    {
        name: "room 2",
        users: []
    }
];

io.on("connection", function(socket){

    io.emit("channels users", channels);

    // Get messages
    socket.on("chat message", function(message){
        // Strip HTML from text message
        message.text = strip(message.text);
        // Parse BBCODE
        message.text = bbcode(message.text);
        // Emit message
        io.emit("chat message", message);
    });

    socket.on("channels enter", function(action) {
        channels = _.map(channels, function(channel) {
            if (channel.name == action.channel && _.indexOf(channel.users, action.username) == -1) {
                channel.users.push(action.username);
            }
            return channel;
        });
        io.emit("channels users", channels);

        _.each(channels, function(channel) {
            if (channel.name == action.channel) {
                io.emit("users of channel", channel.users);
            }
        });

        io.emit("chat message", {channel: action.channel, username: "Room bot", text: bbcode("[B]" + action.username + "[/B] has joined the [B]" + action.channel + "[/B] room.")});
    });

    socket.on("channels leave", function(action) {
        channels = _.map(channels, function(channel) {
            if (channel.name == action.channel) {
                channel.users.splice(channel.users.indexOf(action.username), 1);
                io.emit("users of channel", channel.users);
            }
            return channel;
        });
        io.emit("channels users", channels);
        io.emit("chat message", {channel: action.channel, username: "Room bot", text: bbcode("[B]" + action.username + "[/B] has left the [B]" + action.channel + "[/B] room.")});
    });
});

http.listen(3000, function(){
    console.log("Chat started at localhost:3000");
});
