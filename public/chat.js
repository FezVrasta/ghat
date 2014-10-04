/* globals io */

$(window).on("resize", function() {
    $("body").height($(this).height());
}).trigger("resize");

var socket = io();

var session = {
    username: ($.cookie("username")) ? $.cookie("username") : null,
    channel: "initial"
};

// Init channels list and keep updated
var $channels = $("#channels");
socket.on("channels users", function(channels) {
    $channels.empty();
    channels.forEach(function(channel) {
        var $channel = $("<div class=channel data-channel=\"" + channel.name + "\"><span class=counter>" + channel.users.length + "</span>" + channel.name + "</div>");
        if (channel.name == session.channel) {
            $channel.addClass("active");
        }
        $channels.append($channel);
    });
});

var $users = $("#users");
socket.on("users of channel", function(users) {
    $users.empty();
    users.forEach(function(user) {
        $users.append("<div class=user>" + user + "</div>");
    });
});

$(document).on("click", ".channel, .card", function(e) {
    if ($(e.target).is(".close")) { return false; }
    $("#channels .channel, .cards .card").removeClass("active");

    var chan = $(this).attr("data-channel");
    session.channel = chan;
    $("#channelswrapper .channelbox").removeClass("active");
    if ($("#channelswrapper [data-channel='" + chan + "']").length) {
        $("[data-channel='" + chan + "']").addClass("active");
        $(this).addClass("active");
    } else {
        socket.emit("channels enter", {username: session.username, channel: chan});
        $("#channelswrapper").append("<ul data-channel='" + chan + "' class=\"channelbox active\"></ul>");
        $(".cards").append("<div class=\"card active\" data-channel=\"" + chan + "\">" + chan + "<span class=close>&times;</span></div>");
    }
    $("#m").focus();
});

$(document).on("click", ".cards .card .close", function() {
    var chan = $(this).parent().attr("data-channel");
    if (chan == session.channel) {
        session.channel = "initial";
        $("[data-channel='initial']").addClass("active");
    }
    if ($(".cards .card").length == 1) {
        session.channel = null;
    }
    $(this).parent().remove();
    $("#channelswrapper [data-channel='" + chan + "']").remove();

    socket.emit("channels leave", {username: session.username, channel: chan});

});


if (!session.username) {
    // Show login modal
    $("#login").modal({
        backdrop: "static",
        keyboard: false
    });
} else {
    socket.emit("chat message", {channel: "initial", username: "Welcome bot", text: "Welcome back [B]" + session.username + "[/B]!"});
    socket.emit("channels enter", {username: session.username, channel: session.channel});
}


$("#loginform").submit(function() {
    session.username = $(this).find("[name=username]").val();
    socket.emit("chat message", {channel: session.channel, username: "Welcome bot", text: "Welcome [B]" + session.username + "[/B] to this chat"});
    socket.emit("channels enter", {username: session.username, channel: session.channel});
    $.cookie("username", session.username);
    $("#login").modal("hide");
    return false;
});

$("#chatform").submit(function(){
    var message = {
        channel: session.channel,
        username: session.username,
        text: $("#m").val()
    };

    socket.emit("chat message", message);
    $("#m").val("");
    return false;
});
socket.on("chat message", function(message){
    var row = $("<li>").html("<span class=\"username\">" + message.username + "</span>: " + message.text);
    $("#channelswrapper [data-channel='" + message.channel + "']").append(row);
    $(".channelbox").scrollTop($(".channelbox").height());
});
