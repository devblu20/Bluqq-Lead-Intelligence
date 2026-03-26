"""
BluQQ RAG Engine
─────────────────
Knowledge base se relevant chunks dhundhta hai
aur AI ko context deta hai.

Simple TF-IDF based search — no API key needed,
no external vector database needed.
Production mein OpenAI embeddings + Pinecone use karo.
"""

import os
import json
import math
import re
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# TEXT CHUNKING — Documents ko small pieces mein todna
# ─────────────────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> list[str]:
    """
    Text ko overlapping chunks mein todta hai.
    chunk_size = max words per chunk
    overlap    = kitne words repeat honge
    """
    words  = text.split()
    chunks = []
    start  = 0

    while start < len(words):
        end   = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start = end - overlap

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# TF-IDF SEARCH ENGINE — Simple, fast, no external dependencies
# ─────────────────────────────────────────────────────────────────────────────

class SimpleRAG:
    """
    TF-IDF based knowledge base search.
    Documents load karo → index banao → query karo.
    """

    def __init__(self, kb_folder: str = "knowledge_base"):
        self.kb_folder   = kb_folder
        self.chunks      = []    # [{text, source, chunk_id}]
        self.tfidf_index = {}    # word → {chunk_id → score}
        self.doc_freq    = {}    # word → kitne docs mein hai
        self.loaded      = False

    # ── Documents load karo ───────────────────────────────────────────────────

    def load(self):
        """knowledge_base folder se saare .txt files load karo."""
        kb_path = Path(self.kb_folder)
        if not kb_path.exists():
            print(f"[RAG] ⚠ knowledge_base folder nahi mili: {self.kb_folder}")
            self.loaded = True
            return

        files_loaded = 0
        for fpath in kb_path.glob("*.txt"):
            text = fpath.read_text(encoding="utf-8")
            file_chunks = chunk_text(text)
            for i, chunk in enumerate(file_chunks):
                self.chunks.append({
                    "text":     chunk,
                    "source":   fpath.name,
                    "chunk_id": len(self.chunks)
                })
            files_loaded += 1
            print(f"[RAG] Loaded: {fpath.name} ({len(file_chunks)} chunks)")

        # TF-IDF index banao
        self._build_index()
        self.loaded = True
        print(f"[RAG] ✅ {files_loaded} files, {len(self.chunks)} chunks indexed\n")

    def _tokenize(self, text: str) -> list[str]:
        """Text ko words mein todna — lowercase, punctuation remove."""
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        return [w for w in text.split() if len(w) > 2]

    def _build_index(self):
        """TF-IDF index banao."""
        n = len(self.chunks)
        if n == 0:
            return

        # Document frequency count karo
        for chunk_data in self.chunks:
            words = set(self._tokenize(chunk_data["text"]))
            for word in words:
                self.doc_freq[word] = self.doc_freq.get(word, 0) + 1

        # TF-IDF scores calculate karo
        for chunk_data in self.chunks:
            cid   = chunk_data["chunk_id"]
            words = self._tokenize(chunk_data["text"])
            total = len(words)
            if total == 0:
                continue

            word_count = {}
            for w in words:
                word_count[w] = word_count.get(w, 0) + 1

            for word, count in word_count.items():
                tf  = count / total
                idf = math.log(n / (self.doc_freq.get(word, 1) + 1)) + 1
                score = tf * idf

                if word not in self.tfidf_index:
                    self.tfidf_index[word] = {}
                self.tfidf_index[word][cid] = score

    # ── Search karo ───────────────────────────────────────────────────────────

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        """
        Query ke liye most relevant chunks dhundho.
        Returns list of {text, source, score}
        """
        if not self.loaded:
            self.load()

        if not self.chunks:
            return []

        query_words = self._tokenize(query)
        scores      = {}

        for word in query_words:
            if word in self.tfidf_index:
                for cid, score in self.tfidf_index[word].items():
                    scores[cid] = scores.get(cid, 0) + score

        if not scores:
            return []

        # Top-k chunks sort karo
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        results = []
        for cid, score in ranked[:top_k]:
            chunk = self.chunks[cid]
            results.append({
                "text":   chunk["text"],
                "source": chunk["source"],
                "score":  round(score, 4)
            })

        return results

    def get_context(self, query: str, top_k: int = 3) -> str:
        """
        Query ke liye context string banao —
        ye system prompt mein inject hoga.
        """
        results = self.search(query, top_k)

        if not results:
            return ""

        parts = ["\n\n--- KNOWLEDGE BASE CONTEXT ---"]
        for i, r in enumerate(results, 1):
            parts.append(f"\n[Source: {r['source']}]")
            parts.append(r["text"])

        parts.append("\n--- END CONTEXT ---")
        parts.append(
            "\nIMPORTANT: Use the above context to answer the caller's question accurately. "
            "If the context contains the answer, use it. "
            "Keep your response concise — 2-3 sentences max."
        )

        return "\n".join(parts)

    def stats(self) -> dict:
        return {
            "total_chunks":    len(self.chunks),
            "total_words":     len(self.tfidf_index),
            "files": list(set(c["source"] for c in self.chunks))
        }


# ─────────────────────────────────────────────────────────────────────────────
# Global RAG instance — ek baar load, baar baar use
# ─────────────────────────────────────────────────────────────────────────────

rag = SimpleRAG(kb_folder="knowledge_base")


def init_rag():
    """Server start pe ek baar call karo."""
    rag.load()


def get_rag_context(query: str, top_k: int = 3) -> str:
    """Phone server mein call karo — context string milega."""
    return rag.get_context(query, top_k)


def get_rag_stats() -> dict:
    return rag.stats()


# ─────────────────────────────────────────────────────────────────────────────
# Test — seedha chalao
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("RAG Engine Test\n" + "─" * 40)
    rag.load()

    test_queries = [
        "What is the pricing for trading tools?",
        "Do you offer refunds?",
        "What technologies do you use?",
        "How long does a project take?",
        "Can you build a real-time dashboard?",
    ]

    for query in test_queries:
        print(f"\nQuery: {query}")
        results = rag.search(query, top_k=2)
        for r in results:
            print(f"  [{r['source']}] score={r['score']}")
            print(f"  {r['text'][:100]}...")