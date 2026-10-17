import 'package:flutter/material.dart';

import '../data/letter_store.dart';
import 'editor_screen.dart';
import 'preview_screen.dart';
import 'storage_notice.dart';

/// Landing screen — reads past letters strictly from local storage.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<LetterStore> _storeFuture;
  static const _noticeKey = 'storage_notices';

  @override
  void initState() {
    super.initState();
    _storeFuture = LetterStore.instance();
    _maybeShowStorageWarning();
  }

  Future<void> _maybeShowStorageWarning() async {
    // PRD Boundary #2: users must be explicitly warned that app-storage resets
    // permanently delete unexported drafts (no cloud backup exists).
    if (StorageNotice.hasAcknowledged) return;
    await StorageNotice.ensureAcknowledged(_noticeKey);
    if (!mounted) return;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Local storage notice'),
        content: const Text(
          'All letters and drafts are stored ONLY on this device — no cloud '
          'backup exists. Deleting app data, uninstalling, or resetting your '
          'device will permanently erase history you have not exported.\n\n'
          'Please export and share important PDFs regularly.',
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await StorageNotice.acknowledge(_noticeKey);
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: const Text('I understand'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD4AF37),
        foregroundColor: const Color(0xFF0A0A0A),
        icon: const Icon(Icons.edit),
        label: const Text('New Letter'),
        onPressed: () async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const EditorScreen()),
          );
          setState(() => _storeFuture = LetterStore.instance());
        },
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _header(context),
            // Persistent storage-isolation banner.
            Material(
              color: const Color(0xFFD4AF37).withValues(alpha: 0.12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline,
                        size: 16, color: Color(0xFFD4AF37)),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Letters live only on this device. Nothing is uploaded.',
                        style: TextStyle(
                            fontSize: 11, color: Color(0xFFE4E4E4)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: FutureBuilder<LetterStore>(
                future: _storeFuture,
                builder: (context, snapshot) {
                  if (!snapshot.hasData) {
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xFFD4AF37)));
                  }
                  final letters = snapshot.data!.list();
                  if (letters.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.history_edu,
                              size: 56, color: Color(0xFF6B6B6B)),
                          const SizedBox(height: 12),
                          Text(
                            'No letters yet.\nTap "New Letter" to write your first one.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: const Color(0xFFE4E4E4).withValues(alpha: 0.7)),
                          ),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: letters.length,
                    itemBuilder: (context, i) {
                      final letter = letters[i];
                      return Card(
                        color: const Color(0xFF161616),
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: const BorderSide(color: Color(0xFF2A2A2A)),
                        ),
                        child: ListTile(
                          title: Text(
                            letter.to.isEmpty ? 'Untitled letter' : letter.to,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${letter.date}  ·  ${letter.paperFormat}'
                            '${letter.pdfPath != null ? '  ·  ✓ PDF ready' : '  ·  draft'}',
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFF8A8A8A)),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: Color(0xFF8A8A8A)),
                            onPressed: () => snapshot.data!
                                .delete(letter.id)
                                .then((_) => setState(() {})),
                          ),
                          onTap: () async {
                            final Widget destination =
                                letter.pdfPath != null
                                    ? PreviewScreen(letter: letter)
                                    : EditorScreen(draft: letter);
                            await Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                  builder: (_) => destination),
                            );
                            setState(
                                () => _storeFuture = LetterStore.instance());
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Row(
        children: [
          const Text(
            'Letters',
            style: TextStyle(
                fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const Spacer(),
          FutureBuilder<LetterStore>(
            future: _storeFuture,
            builder: (context, snap) {
              final count = snap.hasData ? snap.data!.list().length : 0;
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF161616),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF2A2A2A)),
                ),
                child: Text('$count',
                    style: const TextStyle(
                        color: Color(0xFFD4AF37),
                        fontWeight: FontWeight.bold)),
              );
            },
          ),
        ],
      ),
    );
  }
}
