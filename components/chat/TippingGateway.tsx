import React, { useState } from 'react';

const TippingGateway = () => {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [validationMessage, setValidationMessage] = useState('');

  const validateAmount = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
        setValidationMessage('Please enter a valid amount.');
        return false;
    }

    if (currency === 'PLN') {
      if (numericAmount < 5) {
        setValidationMessage('For PLN, the minimum amount is 5 PLN.');
        return false;
      }
    } else {
      if (numericAmount < 1) {
        setValidationMessage(`For ${currency}, the minimum amount is 1 ${currency}.`);
        return false;
      }
    }

    setValidationMessage('');
    return true;
  };

  const handleNextStep = () => {
    if (validateAmount()) {
      setStep(2);
    }
  };

  const handleFinalStep = () => {
    setStep(3);
  };

  const buttonStyle = {
    width: '100px',
    padding: '10px',
    margin: '5px',
  };

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {/* Step 1: Amount and Currency Selection */}
      {step === 1 && (
        <div>
          <h2>Step 1: Select Amount and Currency</h2>
          <div>
            <label>
              Currency:
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="PLN">PLN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
          <div>
            <label>
              Amount:
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          </div>
          {validationMessage && <p style={{ color: 'red' }}>{validationMessage}</p>}
          <button onClick={handleNextStep} style={buttonStyle}>Next</button>
        </div>
      )}

      {/* Step 2: Confirmation */}
      {step === 2 && (
        <div>
          <h2>Step 2: Confirmation</h2>
          <p>Amount: {amount} {currency}</p>
          <button onClick={() => setStep(1)} style={buttonStyle}>Back</button>
          <button onClick={handleFinalStep} style={buttonStyle}>Napiwkuj</button>
        </div>
      )}

      {/* Step 3: Thank You */}
      {step === 3 && (
        <div>
          <h2>Thank You!</h2>
          <p>Your tip has been received.</p>
          <button onClick={() => setStep(2)} style={buttonStyle}>Back</button>
        </div>
      )}
    </div>
  );
};

export default TippingGateway;
