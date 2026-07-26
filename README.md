# KhedutConnect — Improved Full Project

KhedutConnect is a Gujarati-friendly farmer marketplace with separate **Buyer**, **Farmer**, and **Admin** dashboards. The backend is Node.js, Express and MongoDB. The same Express server serves the frontend, so only one server command is required.

## Main improvements in this build

- Secure first-admin registration using a private `ADMIN_SETUP_KEY`
- Admin dashboard can create additional admin, farmer and buyer accounts
- Admin role change, protected last-admin rules and user removal safeguards
- Real crop photo capture/upload with browser-side compression
- Complete farmer product add, edit and delete workflow
- Product quality, farming method, harvest date, stock and ratings
- Direct orders with atomic stock reservation and release on cancellation/rejection
- Multi-farmer order preview, allocation, acceptance, rejection, replacement and delivery tracking
- Buyer/farmer chat contacts generated automatically from orders and conversations
- Equipment booking workflow with admin status management
- Buyer reviews restricted to delivered purchases
- Profile editing, password changing, Gujarati/Hindi/English switcher and dark mode
- Relative API URLs, safer input handling, security headers and improved mobile layouts

## 1. Open the correct folder

Open the folder that directly contains:

```text
package.json
index.html
backend/
pages/
js/
css/
```

## 2. Install packages

In the VS Code PowerShell terminal:

```powershell
npm install
npm --prefix backend install
```

## 3. Create the environment file

```powershell
Copy-Item backend\.env.example backend\.env
```

Open `backend/.env` and set your real values:

```env
MONGO_URI=mongodb://127.0.0.1:27017/khedutconnect
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
ADMIN_SETUP_KEY=your-private-first-admin-key
PORT=5000
CORS_ORIGIN=http://localhost:5000
```

For MongoDB Atlas, replace `MONGO_URI` with the Atlas connection string and allow your current IP under Atlas **Network Access**.

## 4. Start the project

```powershell
npm start
```

Open:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

## Admin account process

### Create the first admin

1. Make sure `ADMIN_SETUP_KEY` is present in `backend/.env`.
2. Restart the server after changing `.env`.
3. Open `http://localhost:5000/pages/register.html`.
4. Select **Admin**.
5. Enter the same private setup key.
6. Complete the form and submit it.

The first-admin endpoint stops working after one administrator exists. A normal API registration request cannot create an admin.

### Create another admin later

1. Login as an existing administrator.
2. Open **Users & Admins**.
3. Click **Create Account**.
4. Select the **Admin** role and enter the new account details.

This is the secure version of the admin registration process adopted from the earlier Khedut project. It keeps the useful multi-account workflow without allowing any public user to make themselves an administrator.

## Optional hackathon demo data

After configuring MongoDB:

```powershell
npm run seed:demo
npm start
```

Demo accounts:

```text
Admin:  admin@khedutconnect.demo / Admin@123
Buyer:  buyer@khedutconnect.demo / Buyer@123
Farmer: farmer1@khedutconnect.demo / Farmer@123
Farmer: farmer2@khedutconnect.demo / Farmer@123
Farmer: farmer3@khedutconnect.demo / Farmer@123
```

The demo creates three Wheat listings so a buyer can request 500 kg and demonstrate one order being fulfilled by multiple farmers. Because seeding creates an administrator, use that demo admin to create your personal admin from the dashboard.

## Test the project

```powershell
npm test
```

The included tests cover input validation, role restrictions, product validation, multi-farmer status calculation, static pages, API health and API 404 handling.

## Main role workflows

### Farmer

Register → add product and crop photo → receive direct/bulk allocations → accept or reject → chat with buyer → mark delivered → see analytics.

### Buyer

Register → browse/filter products → place direct order or preview multi-farmer split → track fulfillment → chat → book equipment → review delivered crop.

### Admin

Create/manage accounts → inspect all listings → cancel problem orders → trigger bulk reallocation → manage equipment bookings → review platform analytics → update profile/password.

## Important security notes

- Never upload or share `backend/.env`.
- Change all demo passwords before real use.
- Use a long random JWT secret and admin setup key.
- The project stores compressed crop photos as data URLs for a simple hackathon deployment. For production, move images to object storage such as Cloudinary, S3 or Firebase Storage.
- Payments are not processed in this version; order values are tracking estimates only.
