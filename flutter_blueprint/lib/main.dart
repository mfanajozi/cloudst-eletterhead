import 'package:flutter/material.dart';

import 'core/brand.dart';
import 'data/letter_store.dart';
import 'ui/history_screen.dart';

/// CloudST eLetterhead — standalone white-label client core engine.
/// Runs fully offline: all letters persist on-device (PRD System Boundary #1).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LetterStore.instance(); // boot Hive on the correct platform backend
  runApp(const ELetterheadApp());
}

class ELetterheadApp extends StatelessWidget {
  const ELetterheadApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: APP_NAME,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFD4AF37),
          brightness: Brightness.dark,
          primary: const Color(0xFFD4AF37),
          surface: const Color(0xFF161616),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        fontFamily: 'Roboto',
      ),
      home: const HistoryScreen(),
    );
  }
}
