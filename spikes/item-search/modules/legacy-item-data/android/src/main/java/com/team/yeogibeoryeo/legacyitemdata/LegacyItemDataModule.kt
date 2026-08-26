package com.team.yeogibeoryeo.legacyitemdata

import android.database.sqlite.SQLiteDatabase
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.stringPreferencesKey
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlinx.coroutines.flow.first

class LegacyItemDataModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("LegacyItemData")

            AsyncFunction("readLegacyItemData").SuspendBody<Map<String, Any>> {
                val context = requireNotNull(appContext.reactContext)
                val databaseFile = context.getDatabasePath(FAVORITE_DATABASE_NAME)
                val preferencesFile =
                    File(
                        context.filesDir,
                        "datastore/$ITEM_PREFERENCES_NAME.preferences_pb",
                    )
                val sourceFound = databaseFile.isFile || preferencesFile.isFile

                mapOf(
                    "sourceFound" to sourceFound,
                    "favorites" to readItemFavorites(databaseFile),
                    "homeCategoryIds" to readHomeCategoryIds(preferencesFile),
                )
            }
        }

    private fun readItemFavorites(databaseFile: File): List<Map<String, Any>> {
        if (!databaseFile.isFile) return emptyList()

        return SQLiteDatabase.openDatabase(
            databaseFile.path,
            null,
            SQLiteDatabase.OPEN_READONLY,
        ).use { database ->
            database.rawQuery(
                """
                SELECT targetId, savedAtMillis
                FROM favorites
                WHERE type = ?
                ORDER BY savedAtMillis DESC
                """.trimIndent(),
                arrayOf(ITEM_GUIDE_TYPE),
            ).use { cursor ->
                buildList {
                    while (cursor.moveToNext()) {
                        val targetId = cursor.getString(0)?.trim().orEmpty()
                        if (targetId.isNotEmpty()) {
                            add(
                                mapOf(
                                    "targetId" to targetId,
                                    "savedAtMillis" to cursor.getLong(1),
                                ),
                            )
                        }
                    }
                }
            }
        }
    }

    private suspend fun readHomeCategoryIds(preferencesFile: File): List<String> {
        if (!preferencesFile.isFile) return emptyList()

        val dataStore =
            PreferenceDataStoreFactory.create(
                produceFile = { preferencesFile },
            )
        val stored = dataStore.data.first()[HOME_CATEGORY_KEY].orEmpty()
        return stored
            .split(CATEGORY_SEPARATOR)
            .map(String::trim)
            .filter(String::isNotEmpty)
            .distinct()
    }

    private companion object {
        const val FAVORITE_DATABASE_NAME = "yeogi_beoryeo_favorites.db"
        const val ITEM_PREFERENCES_NAME = "item_preferences"
        const val ITEM_GUIDE_TYPE = "ITEM_GUIDE"
        const val CATEGORY_SEPARATOR = ","
        val HOME_CATEGORY_KEY = stringPreferencesKey("pinned_disposal_categories")
    }
}
