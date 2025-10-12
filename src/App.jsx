rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isValidPO() {
      let data = request.resource.data;
      return data.keys().hasAll(['poNumber', 'geo']) &&
             data.poNumber is string &&
             data.geo is string &&
             data.geo in ['APAC', 'MEA', 'E&A', 'COE (Plan)'] &&
             (data.totalAmount is string || data.totalAmount is number);
    }
    
    function isValidUpdate() {
      let allowedFields = ['poNumber', 'poName', 'geo', 'expiryDate', 'totalAmount', 
                          'campaigns', 'invoicing', 'projectStatus', 
                          'lastModifiedBy', 'lastModifiedAt'];
      return request.resource.data.diff(resource.data)
               .affectedKeys()
               .hasOnly(allowedFields);
    }
    
    // Shared POs - Team workspace
    match /shared_pos/{poId} {
      // Anyone authenticated can read
      allow read: if isSignedIn();
      
      // Anyone authenticated can create with valid data
      allow create: if isSignedIn() && isValidPO();
      
      // Anyone authenticated can update with valid fields
      allow update: if isSignedIn() && isValidUpdate();
      
      // Anyone authenticated can delete
      allow delete: if isSignedIn();
    }
    
    // Audit logs - Write only, admin read
    match /audit_logs/{logId} {
      // Anyone can write audit logs
      allow create: if isSignedIn();
      
      // Only system can read (for future admin panel)
      allow read: if false; // Change to admin check when admin panel is ready
    }
    
    // User profiles (for future use)
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }
  }
}
