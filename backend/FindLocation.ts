import * as ngeohash from 'ngeohash';
import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.LOCATIONS_TABLE;

interface Location {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface QueryParameters {
    lat: number;
    lon: number;
    radius: number;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const queryParams: QueryParameters = {
            lat: parseFloat(event.queryStringParameters.lat),
            lon: parseFloat(event.queryStringParameters.lon),
            radius: parseFloat(event.queryStringParameters.radius),
        };

        const result = await getLocationsWithinRadius(queryParams);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({message: 'An error occurred while processing your request'}),
        };
    }
}

async function getLocationsWithinRadius(params: QueryParameters): Promise<Location[]> {
    const precision = calculateGeohashPrecision(params.radius);
    const centerGeohash = ngeohash.encode(params.lat, params.lon, precision);
    const geohashRange = ngeohash.neighbors(centerGeohash);
    geohashRange.push(ngeohash.encode(params.lat, params.lon));

    const queryPromises = geohashRange.map(async (geohash) => {
        const queryResult = await dynamoDb
            .query({
                TableName: tableName,
                IndexName: 'Geohash-index',
                KeyConditionExpression: 'geohash = :geohash',
                ExpressionAttributeValues: {
                    ':geohash': geohash,
                },
            })
            .promise();

        return queryResult.Items as Location[];
    });

    const results = await Promise.all(queryPromises);
    const locations: Location[] = results.flat();

    return locations.filter((location) => haversineDistance(params.lat, params.lon, location.latitude, location.longitude) <= params.radius);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const R = 6371; // Earth's radius in kilometers

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function calculateGeohashPrecision(radius: number): number {
    // Adjust the geohash precision based on the radius
    if (radius >= 5000) return 2;
    if (radius >= 1250) return 3;
    if (radius >= 156) return 4;
    if (radius >= 39) return 5;
    if (radius >= 5) return 6;
    if (radius >= 0.625) return 7;
    return 8; // Max precision for the smallest radius
}