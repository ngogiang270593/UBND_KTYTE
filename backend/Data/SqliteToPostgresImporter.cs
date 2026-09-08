using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace backend.Data;

public static class SqliteToPostgresImporter
{
    public static async Task ImportAsync(string sqlitePath, AppDbContext destination, ILogger logger)
    {
        if (!File.Exists(sqlitePath))
            throw new FileNotFoundException("SQLite import file was not found.", sqlitePath);

        var sourceOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={sqlitePath}")
            .Options;
        await using var source = new AppDbContext(sourceOptions);
        if (!await source.Database.CanConnectAsync())
            throw new InvalidOperationException("Cannot connect to the SQLite import database.");

        var entityTypes = destination.Model.GetEntityTypes()
            .Where(entityType => !entityType.IsOwned() && entityType.ClrType is not null)
            .OrderBy(entityType => entityType.GetTableName(), StringComparer.Ordinal)
            .ToList();

        var sourceTableNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await source.Database.OpenConnectionAsync();
        await using (var command = source.Database.GetDbConnection().CreateCommand())
        {
            command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table';";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                sourceTableNames.Add(reader.GetString(0));
        }
        await source.Database.CloseConnectionAsync();
        foreach (var entityType in entityTypes)
        {
            var entityTypeName = entityType.ClrType.Name;
            var setMethod = typeof(DbContext).GetMethod(nameof(DbContext.Set), Type.EmptyTypes)!;
            var sourceTableName = entityType.GetTableName();
            if (sourceTableName is null || !sourceTableNames.Contains(sourceTableName))
            {
                logger.LogInformation("Skipped {Table}: it does not exist in the SQLite source.", entityType.ClrType.Name);
                continue;
            }

            var destinationSet = (IQueryable)setMethod.MakeGenericMethod(entityType.ClrType).Invoke(destination, null)!;
            if (destinationSet.Cast<object>().Any())
                throw new InvalidOperationException($"Import stopped: destination table {entityTypeName} already contains data.");

            var sourceSet = (IQueryable)setMethod.MakeGenericMethod(entityType.ClrType).Invoke(source, null)!;
            var records = sourceSet.Cast<object>().ToList();
            if (records.Count == 0)
                continue;

            foreach (var record in records)
            {
                foreach (var property in entityType.ClrType.GetProperties().Where(property => property.CanWrite))
                {
                    if (property.PropertyType != typeof(DateTime) && Nullable.GetUnderlyingType(property.PropertyType) != typeof(DateTime))
                        continue;
                    if (property.GetValue(record) is DateTime value)
                        property.SetValue(record, value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc));
                }
            }

            destination.AddRange(records);
            await destination.SaveChangesAsync();
            destination.ChangeTracker.Clear();
            logger.LogInformation("Imported {Count} record(s) into {Table}.", records.Count, entityTypeName);
        }

        foreach (var entityType in entityTypes)
        {
            var primaryKey = entityType.FindPrimaryKey();
            var keyProperty = primaryKey?.Properties.SingleOrDefault();
            var tableName = entityType.GetTableName();
            var columnName = keyProperty?.GetColumnName();
            if (tableName is null || columnName is null || keyProperty?.ClrType != typeof(int))
                continue;

            var quotedTable = tableName.Replace("\"", "\"\"");
            var quotedColumn = columnName.Replace("\"", "\"\"");
            var sql = $"""
                SELECT setval(
                    pg_get_serial_sequence('public.\"{quotedTable}\"', '{quotedColumn}'),
                    COALESCE((SELECT MAX(\"{quotedColumn}\") FROM \"{quotedTable}\"), 1),
                    (SELECT COUNT(*) > 0 FROM \"{quotedTable}\")
                );
                """;
            await destination.Database.ExecuteSqlRawAsync(sql);
        }
    }
}
