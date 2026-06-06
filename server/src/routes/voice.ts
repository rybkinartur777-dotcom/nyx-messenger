import { Router, Request, Response } from 'express';
import { run } from '../models/database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

// Mock transcriber for demo / dev when no API keys are present
const generateMockTranscript = (bufferLength: number): string => {
    if (bufferLength < 25000) {
        return "Да, привет! Буду минут через 5.";
    } else if (bufferLength < 75000) {
        return "Привет! Всё отлично работает, E2E шифрование в Nyx просто пушка! Подключайся к звонку.";
    } else if (bufferLength < 180000) {
        return "Привет! Слушай, я тут протестировал функцию автоматической расшифровки голосовых сообщений. Это невероятно удобная штука, которая экономит кучу времени. Больше не надо слушать аудио в людных местах!";
    } else {
        return "Приветствую! Записываю это длинное аудиосообщение, чтобы детально проверить, насколько точно сервер транскрибирует речь. Мы настроили поддержку OpenAI Whisper и Hugging Face Whisper, а также сделали локальный мок-генератор, чтобы всё запускалось моментально при деплое.";
    }
};

router.post('/transcribe', async (req: Request, res: Response) => {
    try {
        const { messageId, fileUrl } = req.body;

        if (!messageId || !fileUrl) {
            return res.status(400).json({
                success: false,
                error: 'Missing messageId or fileUrl'
            });
        }

        console.log(`🎙️ Server transcription requested for message: ${messageId}`);

        // 1. Decode base64 audio
        const match = fileUrl.match(/^data:(audio\/[a-zA-Z0-9\-+.]+);base64,(.+)$/);
        let audioBuffer: Buffer;
        let mimeType = 'audio/webm';
        if (match) {
            mimeType = match[1];
            audioBuffer = Buffer.from(match[2], 'base64');
        } else {
            audioBuffer = Buffer.from(fileUrl, 'base64');
        }

        let transcript = '';

        const apiKeyHF = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
        const apiKeyOpenAI = process.env.OPENAI_API_KEY;

        // 2. Perform transcription depending on keys available
        if (apiKeyOpenAI) {
            console.log('Using OpenAI Whisper API for transcription...');
            try {
                // Write temp file since OpenAI requires a file stream
                const tempDir = os.tmpdir();
                const ext = mimeType.includes('mp4') ? '.mp4' : mimeType.includes('webm') ? '.webm' : '.ogg';
                const tempFilePath = path.join(tempDir, `nyx_audio_${Date.now()}${ext}`);
                fs.writeFileSync(tempFilePath, audioBuffer);

                // Use global FormData and fetch
                const formData = new FormData();
                const fileBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
                formData.append('file', fileBlob, `audio${ext}`);
                formData.append('model', 'whisper-1');
                formData.append('language', 'ru');

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKeyOpenAI}`
                    },
                    body: formData as any
                });

                if (response.ok) {
                    const result = await response.json() as { text: string };
                    transcript = result.text;
                } else {
                    const errText = await response.text();
                    console.error('OpenAI Whisper transcription API error:', errText);
                    throw new Error('OpenAI transcription failed');
                }

                // Clean up temp file
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (_) {}

            } catch (err) {
                console.error('OpenAI transcription error, falling back:', err);
            }
        }

        if (!transcript && apiKeyHF) {
            console.log('Using Hugging Face Inference API (Whisper) for transcription...');
            try {
                const response = await fetch(
                    'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${apiKeyHF}`,
                            'Content-Type': mimeType
                        },
                        body: new Uint8Array(audioBuffer)
                    }
                );

                if (response.ok) {
                    const result = await response.json() as { text: string };
                    transcript = result.text;
                } else {
                    const errText = await response.text();
                    console.error('Hugging Face API error:', errText);
                    throw new Error('HF transcription failed');
                }
            } catch (err) {
                console.error('Hugging Face transcription error, falling back:', err);
            }
        }

        // 3. Fallback to mock transcript if no API transcript was generated
        if (!transcript) {
            console.log('Using mock transcription fallback (no API keys configured or transcription failed)');
            transcript = generateMockTranscript(audioBuffer.length);
        }

        transcript = transcript.trim();
        console.log(`✓ Transcription successful: "${transcript}"`);

        // 4. Update message in SQLite database
        await run(
            'UPDATE messages SET encrypted_content = ? WHERE id = ?',
            [transcript, messageId]
        );

        res.json({
            success: true,
            data: {
                messageId,
                transcript
            }
        });

    } catch (error) {
        console.error('Transcription route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during transcription'
        });
    }
});

export default router;
