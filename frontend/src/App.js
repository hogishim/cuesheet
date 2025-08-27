import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 파일 선택 처리
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('PDF 파일만 업로드 가능합니다.');
      setFile(null);
    }
  };

  // 대본 생성 요청
  const generateScript = async () => {
    if (!file) {
      setError('PDF 파일을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/generate-script',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setScript(response.data.script);
      } else {
        setError('대본 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setFile(null);
    setScript('');
    setError('');
    // 파일 input 초기화
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📺 라이브 방송 대본 생성기</h1>
        <p>제품 정보 PDF를 업로드하면 AI가 방송 대본을 작성해드립니다.</p>
      </header>

      <main className="App-main">
        {/* PDF 업로드 영역 */}
        <div className="upload-section">
          <div className="upload-box">
            <input
              id="file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? (
                <div>
                  <p>📄 선택된 파일:</p>
                  <p className="file-name">{file.name}</p>
                </div>
              ) : (
                <div>
                  <p className="upload-icon">📁</p>
                  <p>PDF 파일을 선택하거나</p>
                  <p>여기로 드래그하세요</p>
                </div>
              )}
            </label>
          </div>

          <div className="button-group">
            <button 
              onClick={generateScript} 
              disabled={!file || loading}
              className="generate-btn"
            >
              {loading ? '생성 중... (약 2분 소요)' : '대본 생성하기'}
            </button>
            <button 
              onClick={handleReset}
              className="reset-btn"
            >
              초기화하기
            </button>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* 생성된 대본 표시 영역 */}
        {script && (
          <div className="script-section">
            <h2>📝 생성된 방송 대본</h2>
            <div className="script-box">
              <pre>{script}</pre>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(script);
                alert('대본이 클립보드에 복사되었습니다!');
              }}
              className="copy-btn"
            >
              📋 대본 복사하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;