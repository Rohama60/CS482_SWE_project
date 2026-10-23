import { useState, type FormEvent } from 'react';

export function ComplaintForm({ reporterId }: { reporterId: string }) {
  const [reportedUsername, setReportedUsername] = useState('');
  const [reason, setReason] = useState('Harassment');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterId, reportedUsername, reason, details })
    });

    if (res.ok) setSubmitted(true);
  };

  const cardStyle = {
    backgroundColor: '#1c1e25',
    border: '1px solid #2a2d38',
    color: '#e8e4dc',
    padding: '24px',
    borderRadius: '12px',
    maxWidth: '400px',
    marginBottom: '20px'
  };

  const fieldGroupStyle = {
    marginBottom: '16px'
  };

  const buttonStyle = {
    backgroundColor: '#c0392b',
    color: '#e8e4dc',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%',
    transition: 'filter 0.2s'
  };

  return (
    <div style={cardStyle}>
      <h4 style={{ marginBottom: '16px', fontSize: '1.2rem', fontFamily: 'var(--font-display)' }}>
        File a User Complaint
      </h4>
      {submitted ? (
        <div style={{ padding: '14px', backgroundColor: 'rgba(46, 204, 113, 0.15)', border: '1px solid #2ecc71', borderRadius: '8px', color: '#2ecc71', fontSize: '0.9rem', textAlign: 'center' }}>
          Complaint submitted. An admin will review the altercation.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={fieldGroupStyle}>
            <label htmlFor="reported-username" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#e8e4dc', opacity: 0.8 }}>
              Offending Username
            </label>
            <input 
              id="reported-username"
              type="text" 
              style={{ width: '100%', padding: '10px 12px', backgroundColor: '#131418', border: '1px solid #2a2d38', borderRadius: '8px', color: '#e8e4dc', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              value={reportedUsername} 
              onChange={(e) => setReportedUsername(e.target.value)} 
              required 
            />
          </div>
          <div style={fieldGroupStyle}>
            <label htmlFor="complaint-reason" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#e8e4dc', opacity: 0.8 }}>
              Reason
            </label>
            <select 
              id="complaint-reason"
              style={{ width: '100%', padding: '10px 12px', backgroundColor: '#131418', border: '1px solid #2a2d38', borderRadius: '8px', color: '#e8e4dc', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Harassment" style={{ backgroundColor: '#1c1e25' }}>Harassment</option>
              <option value="Collusion" style={{ backgroundColor: '#1c1e25' }}>Collusion / Cheating</option>
              <option value="Inappropriate Chat" style={{ backgroundColor: '#1c1e25' }}>Inappropriate Language</option>
            </select>
          </div>
          <div style={fieldGroupStyle}>
            <label htmlFor="complaint-details" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#e8e4dc', opacity: 0.8 }}>
              Altercation Details
            </label>
            <textarea 
              id="complaint-details"
              style={{ width: '100%', padding: '10px 12px', backgroundColor: '#131418', border: '1px solid #2a2d38', borderRadius: '8px', color: '#e8e4dc', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px' }} 
              rows={3} 
              value={details} 
              onChange={(e) => setDetails(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" style={buttonStyle}>
            Submit Complaint
          </button>
        </form>
      )}
    </div>
  );
}
