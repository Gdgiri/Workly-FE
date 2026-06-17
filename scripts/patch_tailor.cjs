const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'pages', 'TailorOrders.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove renderCreateModal() call
content = content.replace('{renderCreateModal()}', '/* renderCreateModal removed */');

// 2. Update "New Order" button to navigate to /tailor/new
content = content.replace(
  `<Button onClick={() => { resetCreateForm(); setShowCreateModal(true); }}>`,
  `<Button onClick={() => navigate(\`/\${appId}/\${businessName}/tailor/new\`)}>`
);

// 3. Ensure useParams is imported
if (!content.includes('useParams')) {
  content = content.replace(
    `useLocation } from 'react-router-dom';`,
    `useLocation, useParams } from 'react-router-dom';`
  );
}

// 4. Add useParams destructuring after useNavigate if not already there
if (!content.includes("const { appId, businessName } = useParams()")) {
  content = content.replace(
    'const navigate = useNavigate();',
    'const navigate = useNavigate();\n    const { appId, businessName } = useParams();'
  );
}

// 5. Add ImageIcon to lucide imports if not present
if (!content.includes('ImageIcon')) {
  content = content.replace(
    "} from 'lucide-react'",
    ", ImageIcon } from 'lucide-react'"
  );
}

// 6. Add specialist and photo display after garment type line
const specialistInsert = `{(g as any).tailor && (
                                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--primary)' }}>
                                                        Specialist: {(g as any).tailor.name}
                                                    </p>
                                                )}
                                                {(g.measurementSnapshot as any)?.photoUrl && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <a 
                                                            href={(g.measurementSnapshot as any).photoUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            style={{ color: 'var(--primary)', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <ImageIcon size={14} /> View Measurement Photo
                                                        </a>
                                                    </div>
                                                )}`;

// Insert specialist+photo before the existing stylePreferences check 
content = content.replace(
  `{g.stylePreferences?.notes && (`,
  specialistInsert + '\n                                                {g.stylePreferences?.notes && ('
);

fs.writeFileSync(filePath, content);
console.log('TailorOrders.tsx patched successfully.');
