package com.team.yeogibeoryeo.migration

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val DATABASE_NAME = "yeogi_beoryeo_favorites.db"
private const val FAVORITES_TABLE = "favorites"
private const val SNAPSHOTS_TABLE = "regional_guide_favorite_snapshots"
private const val REGIONAL_GUIDE_TYPE = "REGIONAL_GUIDE"

class LegacyRegionalGuideFavoritesModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("LegacyRegionalGuideFavorites")

        AsyncFunction("read") {
            val context = appContext.reactContext
                ?: return@AsyncFunction readResult(status = "unavailable")
            val databaseFile = context.getDatabasePath(DATABASE_NAME)

            if (!databaseFile.isFile) {
                return@AsyncFunction readResult(status = "database-missing")
            }

            runCatching {
                SQLiteDatabase.openDatabase(
                    databaseFile.absolutePath,
                    null,
                    SQLiteDatabase.OPEN_READONLY,
                ).use { database ->
                    if (!database.hasTable(FAVORITES_TABLE)) {
                        return@use readResult(
                            status = "unreadable",
                            schemaVersion = database.version,
                        )
                    }

                    val favorites = if (database.hasTable(SNAPSHOTS_TABLE)) {
                        database.readFavoritesWithSnapshots()
                    } else {
                        database.readFavoritesWithoutSnapshots()
                    }

                    readResult(
                        status = "ready",
                        schemaVersion = database.version,
                        favorites = favorites,
                    )
                }
            }.getOrElse {
                readResult(status = "unreadable")
            }
        }
    }
}

private fun SQLiteDatabase.hasTable(tableName: String): Boolean =
    rawQuery(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        arrayOf(tableName),
    ).use(Cursor::moveToFirst)

private fun SQLiteDatabase.readFavoritesWithSnapshots(): List<Map<String, String?>> =
    rawQuery(
        """
        SELECT
            favorites.targetId,
            snapshots.sido,
            snapshots.sigungu,
            snapshots.eupmyeondong,
            snapshots.targetRegionName,
            snapshots.managementZoneName
        FROM favorites
        LEFT JOIN regional_guide_favorite_snapshots AS snapshots
            ON snapshots.targetId = favorites.targetId
        WHERE favorites.type = ?
        ORDER BY favorites.savedAtMillis ASC
        """.trimIndent(),
        arrayOf(REGIONAL_GUIDE_TYPE),
    ).use(::readFavoriteRows)

private fun SQLiteDatabase.readFavoritesWithoutSnapshots(): List<Map<String, String?>> =
    rawQuery(
        """
        SELECT targetId
        FROM favorites
        WHERE type = ?
        ORDER BY savedAtMillis ASC
        """.trimIndent(),
        arrayOf(REGIONAL_GUIDE_TYPE),
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(mapOf("targetId" to cursor.getString(0)))
            }
        }
    }

private fun readFavoriteRows(cursor: Cursor): List<Map<String, String?>> =
    buildList {
        while (cursor.moveToNext()) {
            add(
                mapOf(
                    "targetId" to cursor.getStringOrNull(0),
                    "sido" to cursor.getStringOrNull(1),
                    "sigungu" to cursor.getStringOrNull(2),
                    "eupmyeondong" to cursor.getStringOrNull(3),
                    "targetRegionName" to cursor.getStringOrNull(4),
                    "managementZoneName" to cursor.getStringOrNull(5),
                ),
            )
        }
    }

private fun Cursor.getStringOrNull(columnIndex: Int): String? =
    if (isNull(columnIndex)) null else getString(columnIndex)

private fun readResult(
    status: String,
    schemaVersion: Int? = null,
    favorites: List<Map<String, String?>> = emptyList(),
): Map<String, Any?> =
    mapOf(
        "status" to status,
        "schemaVersion" to schemaVersion,
        "favorites" to favorites,
    )
