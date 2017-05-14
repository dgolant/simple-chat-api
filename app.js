var express = require('express')
var app = express()





// Route definitions
app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})






// Routes I need:
//	 Users:
//		 	>Get List of all users (maybe add a friend functionality at some point?)
//		 	>Get single user by id
//		 	>create user
//		 	>update user
//		 	>delete user
//		 	Conversations:
//			 	>Get List of all threads for a given user
//			 	>Get single thread by id
//			 	>create thread
//			 	>update thread (subject, maybe recipients?, etc)
//		 		>delete thread (this would only delete that user's view of the thread, not the thread itself, might be out of scope)
//				Messages:
//				 	>Get all messages in the conversation (chronological)
//				 	>get a single message by id
//				 	>Create a message (must support emoji and other non-latin chars!!)
//				 	>Delete message from single user's view
// Assumptions In Order Of Importance:
// > This is a POC/Test, it doesn't have to be production-ready, it's more a test of how I think and my coding values.
//		Given that, I am allowed (limitedly) to use a sub-optimal solution in some places (This is mostly for my storage solution vis-a-vis individual messages).
// > These chats only necessarily *need to be* 1:1 between people, but should be built in an extensible way
// > Threads don't need to have a subject necessarily