#!/usr/bin/env python3
# 将微信语音(silk)转文字：silk -> wav -> whisper
import sys
import os
import tempfile

def main():
    if len(sys.argv) < 2:
        print("[错误:缺少文件路径]", flush=True)
        sys.exit(1)

    silk_path = sys.argv[1]

    if not os.path.exists(silk_path):
        print(f"[错误:文件不存在:{silk_path}]", flush=True)
        sys.exit(1)

    try:
        import pilk
        import whisper
    except ImportError as e:
        print(f"[错误:缺少依赖:{e}]", flush=True)
        sys.exit(1)

    wav_path = silk_path + ".wav"
    try:
        pilk.decode(silk_path, wav_path)
    except Exception as e:
        print(f"[错误:silk转换失败:{e}]", flush=True)
        sys.exit(1)

    try:
        model = whisper.load_model("large")
        result = model.transcribe(wav_path, language="zh")
        print(result["text"].strip(), flush=True)
    except Exception as e:
        print(f"[错误:转文字失败:{e}]", flush=True)
        sys.exit(1)
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == "__main__":
    main()
