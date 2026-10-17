// Smoke test: the app shell boots without crashing.
// Hive-backed storage is unavailable on the test harness (no platform
// channels), so HistoryScreen resolves into its error/loading branch — the
// root MaterialApp shell itself must still come up cleanly.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';

import 'package:letterhead_client_app/main.dart';

void main() {
  setUp(() {
    // The test harness has no platform channels, so Hive.initFlutter() inside
    // the app cannot resolve a documents directory. Pre-point Hive at a temp
    // dir — Box paths are then available for the storage-notice check.
    Hive.init(Directory.systemTemp.createTempSync('eletterhead_test').path);
  });

  testWidgets('app shell boots without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const ELetterheadApp());

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
