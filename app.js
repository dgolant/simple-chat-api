const express = require('express');
const app = express();
var bodyParser = require('body-parser');

var dbInterface = require('./db-interface');
var listEndpoints = require('express-list-endpoints');
var emailValidator = require('email-validator');
var helperUtilities = require('./utilities');

app.use(bodyParser.json());






// Fetch all routes and methods
app.get('/', function(req, res) {
    var endpoints = listEndpoints(app);
    res.send(endpoints);
})


/********************************
 *                          	*
 *			USER ROUTES 		*
 *                           	*
 ********************************/


// Fetch all users, or specify a query of username, userid, or useremail
app.get('/users/:id?', function(req, res) {
    var uName = req.query.username;
    var uEmail = req.query.useremail;
    var field = null;
    var value = null;

    // If the id param is not explicitly set,
    // we set the field and value to an existing query param
    // or leave them null to fetch all users
    if (!req.params.id) {
        if (uName) {
            field = 'user_handle';
            value = uName;
        } else if (uEmail) {
            field = 'user_email';
            value = uEmail;
        }
    } else if (req.params.id && isNaN(req.params.id)) {
        field = 'user_id';
        value = null;
    } else {
        field = 'user_id';
        value = req.params.id;
    }

    dbInterface.fetchUsers(field, value, function(returnedUsers) {
        res.json(returnedUsers);
    });

})

// Create a user or update the user for the given username (currently username cannot be updated)
// and Return the new state of the user
app.post('/users/', function(req, res) {

    // The object we'll use to create our user
    var userObject;

    // a collection of missing fields;
    var badFields = [];

    // If a POST body is incomplete, we can't proceed.
    if (!req.body || !req.body.username || !req.body.useremail || !emailValidator.validate(req.body.useremail)) {

        // We let the user know what field they forgot (or if their email is bad)
        if (!req.body.username) badFields.push('username missing');
        if (!req.body.useremail) badFields.push('useremail missing');
        if (!emailValidator.validate(req.body.useremail)) badFields.push('invalid email');
        res.status(400).send({
            error: 'Please provide a user object with at least a username, email, and optionally a given name.',
            status: 400,
            bad_fields: badFields
        });
        return;
    }

    userObject = req.body;

    dbInterface.upsertUser(userObject, function(returnedUser) {
        res.json(returnedUser);
    });
})

// Delete a user by userID and return the number of users deleted (1)
app.delete('/users/:id(\\d+)/', function(req, res) {
    var uID = req.params.id;
    if (!req.params || !req.params.id) {
        res.status(400).send({
            Error: 'User deletion can only be performed if a valid User ID is provided',
            status: 400
        });
        return;
    }
    dbInterface.deleteUser(uID, function(usersDeleted) {
        res.json(usersDeleted);
    });
});


/************************************
 *									*
 *		CONVERSATION ROUTES 		*
 *                           		*
 *************************************/


// Fetch all conversations for the given user
// or a specific conversation by ID
app.get('/users/:userid/conversations/:conversationid?', function(req, res) {
    var conversationID = req.params.conversationid;
    var uID = req.params.userid;

    if ((uID && isNaN(uID)) || (conversationID && isNaN(conversationID))) {
        res.status(400).send('Please be sure both IDs are provided and are numeric');
        return;
    }
    dbInterface.fetchConversationsForUser(uID, conversationID, function(returnedConversations) {
        res.json(returnedConversations);
    });
})

// Create a conversation between two users
app.post('/users/:userid/conversations/', function(req, res) {

    var conversationObject;

    // If a user or recipient is not defined or an integer, we let the user know
    if (!req.body || !req.body.receivingUserID || !req.params.userid || (isNaN(req.body.receivingUserID) || isNaN(req.params.userid))) {
        res.status(400).send('Please provide a numeric userID parameter and a body that includes a \"receivingUserID\"');
        return;
    }

    // Users may not create conversations with themselves
    if (req.params.userid == req.body.receivingUserID) {
        res.status(400).send('Users cannot create conversations with themselves');
        return;
    }


    // Check that these users exist
    helperUtilities.checkTwoUsersExist(req.params.userid, req.body.receivingUserID, function(existenceVal) {
        if (!existenceVal) {
            res.status(400).send('Both Users must exist');
            return;
        } else {
            conversationObject = {
                initiatingUserID: req.params.userid,
                receivingUserID: req.body.receivingUserID,
                conversationTitle: req.body.conversationTitle
            }

            dbInterface.createConversation(conversationObject, function(returnedConversation) {
                res.json(returnedConversation);
            });
        }
    });
});

/************************************
 *									*
 *			MESSAGE ROUTES 			*
 *                           		*
 *************************************/

// Fetch message by user, conversation, and message ID, or all messages on the conversation
app.get('/users/:userid/conversations/:conversationid/messages/:messageid?', function(req, res) {

    var uID = req.params.userid;
    var cID = req.params.conversationid;
    var mID = req.params.messageid ? req.params.messageid : null;

    if ((uID && isNaN(uID)) || (cID && isNaN(cID)) || (mID && isNaN(mID))) {
        res.status(400).send('Please be sure all provided IDs are numeric');
        return;
    }

    dbInterface.fetchMessagesForConversation(uID, cID, mID, function(returnedConversations) {
        res.json(returnedConversations);
    });
});

// Create a message between two users
app.post('/users/:userid/conversations/:conversationid/messages/', function(req, res) {


    var uID = req.params.userid;
    var cID = req.params.conversationid;
    var messageBody = req.body.messageBody;
    var senderID;

    // All params need to be provided, along with a message
    if (!uID || !cID || !messageBody || isNaN(uID) || isNaN(cID)) {
        res.status(400).send('Please be sure to include all query parameters and a message body, and that your encoding is set to JSON.');
        return;
    }

    // Now that we know it exists we can set it
    senderID = uID;

    // fetch the conversation this message will be created for
    dbInterface.fetchConversationsForUser(uID, cID, function(returnedConversationsCollection) {
        // The user who will recieve the message
        var recipientID;
        var validToProceed = true;
        var messageUserValidationErrorMessage;
        var returnedConversation = returnedConversationsCollection[0];

        if (returnedConversation) {
            var userIsConversationInitiator = returnedConversation.dataValues.initiating_user_id == uID
            var userIsConversationReceiver = returnedConversation.dataValues.receiving_user_id == uID
        } else {
        	// The user is not valid on this conversation
            var validToProceed = false;
            messageUserValidationErrorMessage = 'User must be part of conversation.';
        }


        // We set the receiving_user_id to the other user
        if (validToProceed) {
            if (userIsConversationInitiator && userIsConversationReceiver) {
                validToProceed = false;
                messageUserValidationErrorMessage = 'Users cannot send messages to themselves.';
            } else if (!userIsConversationInitiator && !userIsConversationReceiver) {
                validToProceed = false;
                messageUserValidationErrorMessage = 'User must be part of conversation.';
            } else if (userIsConversationInitiator) {
                recipientID = returnedConversation.dataValues.receiving_user_id;
            } else if (userIsConversationReceiver) {
                recipientID = returnedConversation.dataValues.initiating_user_id;
            } else {
                validToProceed = false;
                messageUserValidationErrorMessage = 'Unknown error';
            }
        }
        // That's a long name and an annoying conditional,
        // but essentially if this value is false we have bad data
        if (!validToProceed) {
            res.status(400).send(messageUserValidationErrorMessage);
            return;
        }

        // Check that both users exist now that we know they're not the same one
        // (Limit database calls)
        helperUtilities.checkTwoUsersExist(senderID, recipientID, function(existenceVal) {
            if (!existenceVal) {
                res.status(400).send('Both Users must exist');
                return;
            } else {
                dbInterface.createMessageForConversation(cID, senderID, recipientID, messageBody, function(returnedObject) {
                    res.json(returnedObject);
                });
            }
        });
    })
});

var server = app.listen(process.argv[2] || 3000, function() {
    var port = server.address().port;
    console.log('chat api listening on port ' + port);
})

module.exports = server;




// Routes I need:
//   Users:
//          X>Get List of all users (maybe add a friend functionality at some point?)
//          X>Get single user by id
//          X>create user
//          X>update user
//          X>delete user
//          Conversations:
//              X>Get List of all threads for a given user
//              X>Get single thread by id
//              X>create thread
//              >update thread (subject, maybe recipients?, etc)...this is extra, do later
//              >delete thread (this would only delete that user's view of the thread, not the thread itself, might be out of scope)
//              Messages:
//                  X>Get all messages in the conversation (chronological)
//                  X>get a single message by id
//                  >Create a message (must support emoji and other non-latin chars!!)
//                  >Delete message from single user's view
// Assumptions In Order Of Importance:
// > This is a POC/Test, it doesn't have to be production-ready, it's more a test of how I think and my coding values.
//      Given that, I am allowed (limitedly) to use a sub-optimal solution in some places (This is mostly for my storage solution vis-a-vis individual messages).
// > These chats only necessarily *need to be* 1:1 between people, but should be built in an extensible way
// > Threads don't need to have a subject necessarily
// > Clients shouldn't need to poll, new events should emit
// Comments:
// I think I might also implement a "Entire conversation table" where each row is the entire history
//      of a thread and store conservations as an gestalt object rather than message by message in order to allow for both quick single message lookup by id/text *and* allow for fetching a conservation completely rather than row by row.
// Extra todos:
//     X Validate email.
//     X vALIDATE POSTS to prevent users from starting conversations with themselves
//      validate POSTS to prevent users from messagin themselves
//		users must exist in order to create conversations
