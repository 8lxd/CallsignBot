### 1. **How to Set it Up**

To set up the bot, you need to follow these steps:

1. **Install Dependencies**:
   - First, ensure that you have Node.js installed on your system.
   - Use `npm` (Node package manager) to install the necessary dependencies. Run the following command in your project directory:
     ```bash
     npm install 
     ```

2. **Configure the `.env` File**:
   - Create a `.env` file in the root of your project directory to store sensitive data such as your Discord bot token and any necessary configuration variables.
   - Example `.env` file:
     ```
     DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
     SERVER_IP=YOUR_SERVER_IP
     SERVER_PORT=YOUR_SERVER_PORT
     CALLSIGN_COOLDOWN=30
     ```

3. **Create Data Folders**:
   - Make sure that the `data` folder exists in the root directory to store the `callsigns.json` and `cooldowns.json` files. If it doesn’t exist, the bot will create it.

4. **Run the Bot**:
   - After setting up the dependencies and the `.env` file, you can run the bot using Node.js:
     ```bash
     node bot.js
     ```

   - The bot will log into Discord and start running.

5. **Permissions**:
   - Ensure that the bot has proper permissions in your server, such as managing messages, reading messages, and setting nicknames.

### 2. **Commands and Short Descriptions**

Here’s a breakdown of the available commands and their descriptions:

- `/callsignembed`: 
  - **Description**: Displays a selection embed for users to pick a department and register a callsign.
  - **Permissions**: Requires `ManageMessages` permission.
  
- `/server`: 
  - **Description**: Displays information about the game server, such as the server IP, port, and current status.
  - **Permissions**: No special permissions required.
  
- `/callsigncooldownreset`: 
  - **Description**: Resets the callsign cooldown for a specified user. Useful if a user is unable to select a new callsign due to the cooldown.
  - **Permissions**: Requires `Administrator` permission.
  
- `/callsignremove`: 
  - **Description**: Removes a user’s assigned callsign and resets their nickname in the server.
  - **Permissions**: Requires `Administrator` permission.

### **Additional Details**:
- **Cooldown**: Users must wait a specified time (in this case, configurable via the `.env` file) before they can register a new callsign. Admins can reset cooldowns using `/callsigncooldownreset`.
- **Callsign Expiry**: The callsigns expire after 24 hours. The bot will check for expired callsigns periodically and reset the affected users’ nicknames.
- **Nicknames**: Users' nicknames are updated with their callsign and roleplay name format, such as `3B123 John Doe`.
