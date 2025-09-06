const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function fixWorkspaceMembership() {
  console.log('🔧 Fixing Workspace Membership\n');
  console.log('=' .repeat(60));

  const client = new Client({ connectionString });
  await client.connect();

  const userId = 'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b';
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  
  // Check current state
  console.log('1️⃣ Checking current workspace ownership...\n');
  
  const ownerQuery = `
    SELECT 
      w.id,
      w.name,
      w.owner_id,
      up.auth_user_id,
      up.email
    FROM workspaces w
    LEFT JOIN user_profiles up ON up.id = w.owner_id
    WHERE w.id = $1;
  `;
  
  const { rows: [workspace] } = await client.query(ownerQuery, [workspaceId]);
  
  if (workspace) {
    console.log('   Workspace:', workspace.name);
    console.log('   Owner Profile ID:', workspace.owner_id);
    console.log('   Owner Auth ID:', workspace.auth_user_id);
    console.log('   Owner Email:', workspace.email);
  }
  
  // Check user profile
  console.log('\n2️⃣ Checking user profile...\n');
  
  const profileQuery = `
    SELECT 
      id,
      auth_user_id,
      email
    FROM user_profiles
    WHERE auth_user_id = $1;
  `;
  
  const { rows: [userProfile] } = await client.query(profileQuery, [userId]);
  
  if (userProfile) {
    console.log('   User Profile ID:', userProfile.id);
    console.log('   Auth User ID:', userProfile.auth_user_id);
    console.log('   Email:', userProfile.email);
  }
  
  // Check membership
  console.log('\n3️⃣ Checking workspace membership...\n');
  
  const memberQuery = `
    SELECT 
      wm.*,
      up.email
    FROM workspace_members wm
    JOIN user_profiles up ON up.id = wm.user_id
    WHERE wm.workspace_id = $1;
  `;
  
  const { rows: members } = await client.query(memberQuery, [workspaceId]);
  
  if (members.length > 0) {
    console.log(`   Found ${members.length} member(s):`);
    members.forEach(m => {
      console.log(`     - ${m.email} (role: ${m.role})`);
    });
  } else {
    console.log('   No members found');
  }
  
  // FIX: Update workspace owner if needed
  if (workspace && userProfile && workspace.owner_id !== userProfile.id) {
    console.log('\n4️⃣ FIXING: Updating workspace owner...\n');
    
    const updateQuery = `
      UPDATE workspaces
      SET owner_id = $1
      WHERE id = $2
      RETURNING *;
    `;
    
    const { rows: [updated] } = await client.query(updateQuery, [userProfile.id, workspaceId]);
    
    if (updated) {
      console.log('   ✅ Updated workspace owner to:', userProfile.email);
    }
  } else if (workspace && userProfile && workspace.owner_id === userProfile.id) {
    console.log('\n   ✅ User already owns the workspace');
  }
  
  // Also ensure user is a member
  const memberCheckQuery = `
    SELECT 1 
    FROM workspace_members 
    WHERE workspace_id = $1 AND user_id = $2;
  `;
  
  const { rows: memberExists } = await client.query(memberCheckQuery, [workspaceId, userProfile?.id]);
  
  if (userProfile && memberExists.length === 0) {
    console.log('\n5️⃣ Adding user as workspace member...\n');
    
    const addMemberQuery = `
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES ($1, $2, 'owner', NOW())
      ON CONFLICT (workspace_id, user_id) DO NOTHING
      RETURNING *;
    `;
    
    const { rows: [newMember] } = await client.query(addMemberQuery, [workspaceId, userProfile.id]);
    
    if (newMember) {
      console.log('   ✅ Added user as workspace member');
    }
  }
  
  await client.end();
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n✅ Workspace membership fixed!');
  console.log('   The user should now have access to all workspace data.');
}

fixWorkspaceMembership();