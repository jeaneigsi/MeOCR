import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ScanText,
  Copy,
  Download,
  Loader2,
  X,
  ChevronDown,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface ProcessedImage {
  id: string;
  name: string;
  text: string;
  isProcessing: boolean;
  error?: string;
  imageUrl: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [activeTab, setActiveTab] = useState('home');
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(
    null
  );

  // Traite une image et retourne une Promise qui se résout à la fin du traitement.
  const processImage = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const imageId = Math.random().toString(36).substring(7);
      const imageUrl = URL.createObjectURL(file);

      setProcessedImages((prev) => [
        ...prev,
        {
          id: imageId,
          name: file.name,
          text: '',
          isProcessing: true,
          imageUrl,
        },
      ]);

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async () => {
          const base64Data = (reader.result as string).split(',')[1];

          try {
            const result = await model.generateContentStream([
              'Extract all text from this image and format it in markdown. Include proper headings, lists, and formatting. Ensure to format correctly table also:',
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type,
                },
              },
            ]);

            let fullText = '';
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              fullText += chunkText;
              setProcessedImages((prev) =>
                prev.map((img) =>
                  img.id === imageId ? { ...img, text: fullText } : img
                )
              );
            }

            setProcessedImages((prev) =>
              prev.map((img) =>
                img.id === imageId ? { ...img, isProcessing: false } : img
              )
            );
            resolve();
          } catch (error) {
            setProcessedImages((prev) =>
              prev.map((img) =>
                img.id === imageId
                  ? {
                      ...img,
                      isProcessing: false,
                      error: 'Failed to process image',
                    }
                  : img
              )
            );
            resolve();
          }
        };

        reader.onerror = () => {
          setProcessedImages((prev) =>
            prev.map((img) =>
              img.id === imageId
                ? { ...img, isProcessing: false, error: 'File reading error' }
                : img
            )
          );
          reject(new Error('File reading error'));
        };
      } catch (error) {
        setProcessedImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  isProcessing: false,
                  error: 'Failed to process image',
                }
              : img
          )
        );
        reject(error);
      }
    });
  };

  // Traitement séquentiel des images avec un délai de 10 secondes entre chaque.
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        await processImage(file);
      } catch (e) {
        console.error(e);
      }
      await delay(1000);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadText = (text: string, filename: string) => {
    const element = document.createElement('a');
    const fileBlob = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(fileBlob);
    element.download = `${filename.split('.')[0]}-extracted.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const removeImage = (id: string) => {
    setProcessedImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF0D6]">
      <nav className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="flex items-center">
                <ScanText className="w-6 h-6 sm:w-8 sm:h-8 text-[#D11E1D]" />
                <span className="ml-2 text-lg sm:text-xl font-bold text-[#D11E1D]">
                  OCR Magic
                </span>
              </div>
              <div className="flex space-x-4 sm:space-x-8">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`px-2 sm:px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'home'
                      ? 'text-[#D11E1D] border-b-2 border-[#D11E1D]'
                      : 'text-gray-500 hover:text-[#D11E1D]'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-[#D11E1D]"
                >
                  Graph Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#D11E1D] mb-3 flex items-center justify-center gap-3">
            <ScanText className="w-8 h-8 sm:w-10 sm:h-10" />
            OCR Magic
          </h1>
          <p className="text-gray-700">
            Extract text from multiple images instantly using AI
          </p>
        </div>

        {/* Dropzone for uploading images */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all mb-6 ${
            isDragActive
              ? 'border-[#D11E1D] bg-red-50'
              : 'border-gray-300 hover:border-[#D11E1D]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <ScanText
              className={`w-10 h-10 sm:w-12 sm:h-12 ${
                isDragActive ? 'text-[#D11E1D]' : 'text-gray-400'
              }`}
            />
            <p className="text-gray-700">
              {isDragActive
                ? 'Drop your images here'
                : 'Drag & drop images, or click to select'}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left panel: card grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 w-full ${
              selectedImage ? 'lg:w-1/2' : ''
            } gap-6`}
          >
            {processedImages.map((img) => (
              <div
                key={img.id}
                className={`bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all ${
                  selectedImage?.id === img.id ? 'ring-2 ring-[#D11E1D]' : ''
                }`}
                onClick={() => setSelectedImage(img)}
              >
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-800 truncate">
                    {img.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    {img.isProcessing ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#D11E1D]" />
                        <span className="text-sm text-gray-600">
                          Processing...
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(img.text);
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadText(img.text, img.name);
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(img.id);
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[#D11E1D]"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(img.imageUrl, '_blank');
                    }}
                    className="flex items-center gap-2 text-[#D11E1D] hover:text-red-700 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>View Original Image</span>
                  </button>
                </div>

                {img.error ? (
                  <div className="p-4 text-red-500">{img.error}</div>
                ) : (
                  <div className="relative">
                    <div className="prose prose-sm max-w-none p-4 max-h-32 overflow-hidden">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {img.text}
                      </ReactMarkdown>
                    </div>
                    {img.text.length > 100 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(img);
                        }}
                        className="w-full py-2 px-4 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <ChevronDown className="w-4 h-4" />
                        <span>Show More</span>
                      </button>
                    )}
                  </div>
                )}

                {img.isProcessing && (
                  <div className="h-1 bg-gray-100">
                    <div
                      className="h-full bg-[#D11E1D] animate-[scan_2s_ease-in-out_infinite]"
                      style={{ width: '30%' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right panel: full text display */}
          {selectedImage && (
            <div className="w-full lg:w-1/2 bg-white rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-24">
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 truncate">
                  {selectedImage.name}
                </h2>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div
                className="p-4 overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 100px)' }}
              >
                <div className="prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedImage.text}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center gap-2 mb-4 text-[#D11E1D]">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-xl font-semibold">Coming Soon</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Graph Analysis feature will be available soon. Stay tuned!
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-[#D11E1D] text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
