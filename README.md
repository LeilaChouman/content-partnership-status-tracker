# 📊 Client Project Status Tracker

A real-time, collaborative project management system built with React and Firebase for tracking purchase orders (POs), campaigns, invoicing, and project status across multiple team members.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB.svg)

---

## 🎯 Features

### Core Functionality
- ✅ **Real-time Collaboration** - Multiple users can work simultaneously with instant updates
- ✅ **Purchase Order Management** - Create, edit, and track POs with detailed information
- ✅ **Campaign Tracking** - Manage multiple campaigns per PO with budget tracking
- ✅ **Invoicing Workflow** - Track 50%, 30%, and 20% invoice stages with COC (Certificate of Completion)
- ✅ **Budget Monitoring** - Real-time calculation of spent vs. remaining budget
- ✅ **GEO Filtering** - Filter POs by geographic region (APAC, MEA, E&A, COE)
- ✅ **Role-based Access Control** - Admin, Editor, and Viewer permissions
- ✅ **Presence Indicators** - See who's online and actively editing
- ✅ **CSV Export** - Export all data to CSV format
- ✅ **Collapse All** - Quick view management for large datasets

### User Roles
| Role | Permissions |
|------|-------------|
| **Admin** | Full access - Create, Edit, Delete all content |
| **Editor** | Create and Edit POs and Campaigns (cannot delete) |
| **Viewer** | Read-only access to all data |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Firebase account with Firestore database
- Git installed

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/status-tracker.git
   cd status-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Update the Firebase configuration in `src/App.jsx`:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

---

## 🔐 Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Firestore Database**
4. Enable **Authentication** → Email/Password sign-in

### 2. Database Structure

```
organizations/
  └── {orgId}/
      ├── pos/
      │   └── {poId}/
      │       ├── poNumber: string
      │       ├── poName: string
      │       ├── geo: string
      │       ├── expiryDate: string
      │       ├── totalAmount: number
      │       ├── campaigns: array
      │       ├── invoicing: object
      │       ├── projectStatus: object
      │       ├── createdBy: string
      │       ├── lastModifiedBy: string
      │       └── lastModifiedAt: timestamp
      └── presence/
          └── {userId}/
              ├── email: string
              ├── status: string
              └── lastSeen: timestamp

users/
  └── {userId}/
      ├── email: string
      ├── orgId: string
      ├── role: string
      └── createdAt: timestamp
```

### 3. Security Rules

**Copy these rules to Firebase Console → Firestore Database → Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to get user data
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    // User profiles
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || getUserData().role == 'admin';
    }
    
    // Organization POs - shared by all org members
    match /organizations/{orgId}/pos/{poId} {
      allow read: if request.auth != null && 
        getUserData().orgId == orgId;
      
      allow create: if request.auth != null && 
        getUserData().orgId == orgId &&
        getUserData().role in ['admin', 'editor'];
      
      allow update: if request.auth != null && 
        getUserData().orgId == orgId &&
        getUserData().role in ['admin', 'editor'];
      
      allow delete: if request.auth != null && 
        getUserData().orgId == orgId &&
        getUserData().role == 'admin';
    }
    
    // Presence tracking
    match /organizations/{orgId}/presence/{userId} {
      allow read: if request.auth != null && getUserData().orgId == orgId;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### 4. Create Users

Use Firebase Console or this code to create users:

```javascript
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const createUser
