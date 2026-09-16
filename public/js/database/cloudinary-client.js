// ==========================================
// FILE: js/database/cloudinary-client.js
// FUNGSI:
// Boundary Cloudinary client SIMNI.
// Signature, policy, ownership, dan cleanup ditentukan server.
// ==========================================

import {
    createCloudinaryUploadSignature,
    cleanupCloudinaryUpload
} from '../services/edge-service.js';

const PURPOSE = Object.freeze({
    LOGO: 'logo',
    DOCUMENT: 'document',
    STUDENT_PHOTO: 'student_photo'
});

const ALLOWED_PURPOSES =
    new Set(
        Object.values(
            PURPOSE
        )
    );

const ALLOWED_RESOURCE_TYPES =
    new Set([
        'image',
        'raw',
        'video',
        'auto'
    ]);

let activeUploads = 0;

function cleanText(
    value
) {
    return String(
        value ?? ''
    ).trim();
}

function normalizePurpose(
    purpose
) {
    const normalized =
        cleanText(
            purpose
        ).toLowerCase();

    if (
        !ALLOWED_PURPOSES.has(
            normalized
        )
    ) {
        throw new Error(
            'Purpose upload Cloudinary tidak valid.'
        );
    }

    return normalized;
}

function normalizeResourceType(
    value,
    fallback = 'image'
) {
    const normalized =
        cleanText(
            value ||
            fallback
        ).toLowerCase();

    if (
        !ALLOWED_RESOURCE_TYPES.has(
            normalized
        )
    ) {
        throw new Error(
            'Resource type Cloudinary tidak valid.'
        );
    }

    return normalized;
}

function assertUploadFile(
    file
) {
    if (
        !file ||
        typeof file !==
            'object'
    ) {
        throw new Error(
            'File upload tidak tersedia.'
        );
    }

    const size =
        Number(
            file.size
        );

    if (
        !Number.isFinite(
            size
        ) ||
        size <= 0
    ) {
        throw new Error(
            'Ukuran file upload tidak valid.'
        );
    }

    const mime =
        cleanText(
            file.type
        ).toLowerCase();

    if (!mime) {
        throw new Error(
            'MIME type file tidak tersedia.'
        );
    }

    return {
        size,
        mime
    };
}

function assertHTTPSURL(
    value
) {
    const text =
        cleanText(
            value
        );

    let parsed;

    try {
        parsed =
            new URL(
                text
            );
    } catch (_) {
        throw new Error(
            'Cloudinary tidak mengembalikan URL file yang valid.'
        );
    }

    if (
        parsed.protocol !==
        'https:'
    ) {
        throw new Error(
            'Cloudinary URL wajib menggunakan HTTPS.'
        );
    }

    return parsed.href;
}

function uploadEndpoint({
    cloudName,
    resourceType
}) {
    const safeCloud =
        cleanText(
            cloudName
        );

    if (!safeCloud) {
        throw new Error(
            'Cloudinary cloudName tidak tersedia.'
        );
    }

    const type =
        normalizeResourceType(
            resourceType,
            'auto'
        );

    return (
        'https://api.cloudinary.com/v1_1/' +
        encodeURIComponent(
            safeCloud
        ) +
        '/' +
        encodeURIComponent(
            type
        ) +
        '/upload'
    );
}

function expectedPublicId(
    signature
) {
    return cleanText(
        signature?.publicId ||
        signature
            ?.uploadParams
            ?.public_id
    );
}

function assertSignatureContract(
    signature,
    {
        fileSize,
        mime,
        purpose
    }
) {
    if (
        !signature ||
        typeof signature !==
            'object'
    ) {
        throw new Error(
            'Signature Cloudinary tidak tersedia.'
        );
    }

    const cloudName =
        cleanText(
            signature.cloudName
        );

    const apiKey =
        cleanText(
            signature.apiKey
        );

    const signedValue =
        cleanText(
            signature.signature
        );

    const publicId =
        expectedPublicId(
            signature
        );

    const uploadParams =
        signature.uploadParams;

    if (
        !cloudName ||
        !apiKey ||
        !signedValue ||
        !publicId ||
        !uploadParams ||
        typeof uploadParams !==
            'object'
    ) {
        throw new Error(
            'Kontrak signature Cloudinary server tidak lengkap.'
        );
    }

    if (
        cleanText(
            uploadParams.public_id
        ) !==
        publicId
    ) {
        throw new Error(
            'public_id signature Cloudinary tidak konsisten.'
        );
    }

    const timestamp =
        Number(
            uploadParams.timestamp
        );

    if (
        !Number.isInteger(
            timestamp
        ) ||
        timestamp <= 0
    ) {
        throw new Error(
            'Timestamp signature Cloudinary tidak valid.'
        );
    }

    const uploadPreset =
        cleanText(
            uploadParams.upload_preset
        );

    if (!uploadPreset) {
        throw new Error(
            'Upload preset Cloudinary tidak tersedia.'
        );
    }

    const policy =
        signature.policy;

    if (
        !policy ||
        typeof policy !==
            'object'
    ) {
        throw new Error(
            'Policy upload Cloudinary tidak tersedia.'
        );
    }

    const maxBytes =
        Number(
            policy.maxBytes
        );

    if (
        !Number.isFinite(
            maxBytes
        ) ||
        maxBytes <= 0
    ) {
        throw new Error(
            'Batas ukuran Cloudinary server tidak valid.'
        );
    }

    if (
        fileSize >
        maxBytes
    ) {
        throw new Error(
            `Ukuran file melebihi batas server (${Math.round(maxBytes / 1024 / 1024)} MB).`
        );
    }

    const reportedMime =
        cleanText(
            policy.reportedMime
        ).toLowerCase();

    if (
        reportedMime &&
        reportedMime !==
            mime
    ) {
        throw new Error(
            'MIME file berubah antara client dan policy server.'
        );
    }

    const expectedSegment =
        `/${purpose}/`;

    if (
        !publicId.includes(
            expectedSegment
        )
    ) {
        throw new Error(
            'Scoped public_id Cloudinary tidak cocok dengan purpose.'
        );
    }

    return {
        cloudName,

        apiKey,

        signature:
            signedValue,

        publicId,

        resourceType:
            normalizeResourceType(
                signature.resourceType,
                purpose ===
                    PURPOSE.LOGO
                    ? 'image'
                    : 'auto'
            ),

        uploadParams: {
            public_id:
                publicId,

            timestamp,

            upload_preset:
                uploadPreset
        },

        policy: {
            maxBytes,

            reportedMime,

            enforcedByPreset:
                cleanText(
                    policy.enforcedByPreset
                )
        }
    };
}

function buildUploadForm({
    file,
    contract
}) {
    const form =
        new FormData();

    form.append(
        'api_key',
        contract.apiKey
    );

    form.append(
        'timestamp',
        String(
            contract
                .uploadParams
                .timestamp
        )
    );

    form.append(
        'signature',
        contract.signature
    );

    form.append(
        'public_id',
        contract.publicId
    );

    form.append(
        'upload_preset',
        contract
            .uploadParams
            .upload_preset
    );

    form.append(
        'file',
        file
    );

    return form;
}

async function parseCloudinaryResponse(
    response
) {
    let data;

    try {
        data =
            await response.json();
    } catch (_) {
        throw new Error(
            'Respons Cloudinary bukan JSON valid.'
        );
    }

    if (
        !response.ok ||
        data?.error
    ) {
        throw new Error(
            data?.error
                ?.message ||
            `Upload Cloudinary gagal (${response.status}).`
        );
    }

    return data;
}

function verifyUploadedAsset(
    data,
    {
        contract,
        originalSize,
        purpose
    }
) {
    if (
        !data ||
        typeof data !==
            'object'
    ) {
        throw new Error(
            'Metadata hasil upload Cloudinary tidak valid.'
        );
    }

    const publicId =
        cleanText(
            data.public_id
        );

    const resourceType =
        normalizeResourceType(
            data.resource_type,
            purpose ===
                PURPOSE.LOGO
                ? 'image'
                : 'raw'
        );

    const rawExtensionPattern =
        new RegExp(
            `^${contract.publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[a-z0-9]{1,16}$`,
            'i'
        );

    const publicIdMatches =
        publicId ===
            contract.publicId ||
        (
            resourceType ===
                'raw' &&
            rawExtensionPattern.test(
                publicId
            )
        );

    if (
        !publicIdMatches
    ) {
        throw new Error(
            'public_id hasil upload tidak cocok dengan public_id yang ditandatangani server.'
        );
    }

    const secureUrl =
        assertHTTPSURL(
            data.secure_url
        );

    const bytes =
        Number(
            data.bytes
        );

    if (
        !Number.isFinite(
            bytes
        ) ||
        bytes <= 0
    ) {
        throw new Error(
            'Cloudinary tidak mengembalikan ukuran file yang valid.'
        );
    }

    if (
        bytes >
        contract
            .policy
            .maxBytes
    ) {
        throw new Error(
            'Ukuran hasil upload melebihi policy server.'
        );
    }

    /*
     * Cloudinary dapat melakukan transformasi/metadata encoding,
     * sehingga bytes hasil tidak harus identik dengan File.size.
     * Tetapi nilai harus masuk akal dan tidak boleh nol.
     */
    if (
        originalSize <= 0
    ) {
        throw new Error(
            'Ukuran file sumber tidak valid.'
        );
    }

    if (
        purpose ===
            PURPOSE.LOGO &&
        resourceType !==
            'image'
    ) {
        throw new Error(
            'Logo Cloudinary wajib menghasilkan resource image.'
        );
    }

    return {
        ...data,

        public_id:
            publicId,

        secure_url:
            secureUrl,

        resource_type:
            resourceType,

        bytes
    };
}

function inferPurposeFromPublicId(
    publicId
) {
    const value =
        cleanText(
            publicId
        );

    if (
        value.includes(
            '/logo/'
        )
    ) {
        return PURPOSE.LOGO;
    }

    if (
        value.includes(
            '/document/'
        )
    ) {
        return PURPOSE.DOCUMENT;
    }

    throw new Error(
        'Purpose Cloudinary tidak dapat ditentukan dari public_id.'
    );
}

async function cleanupUploadedAsset({
    purpose,
    publicId,
    resourceType
}) {
    if (!publicId) {
        return {
            ok: true,
            skipped: true
        };
    }

    return cleanupCloudinaryUpload({
        purpose:
            normalizePurpose(
                purpose
            ),

        publicId:
            cleanText(
                publicId
            ),

        resourceType:
            normalizeResourceType(
                resourceType,
                purpose ===
                    PURPOSE.LOGO
                    ? 'image'
                    : 'raw'
            )
    });
}

export async function signedCloudinaryUpload(
    file,
    purpose =
        PURPOSE.DOCUMENT
) {
    const normalizedPurpose =
        normalizePurpose(
            purpose
        );

    const {
        size,
        mime
    } =
        assertUploadFile(
            file
        );

    let contract =
        null;

    let uploadedData =
        null;

    activeUploads +=
        1;

    try {
        const signature =
            await createCloudinaryUploadSignature({
                purpose:
                    normalizedPurpose,

                fileSize:
                    size,

                mime
            });

        contract =
            assertSignatureContract(
                signature,
                {
                    fileSize:
                        size,

                    mime,

                    purpose:
                        normalizedPurpose
                }
            );

        const response =
            await fetch(
                uploadEndpoint({
                    cloudName:
                        contract.cloudName,

                    resourceType:
                        contract.resourceType
                }),
                {
                    method:
                        'POST',

                    body:
                        buildUploadForm({
                            file,

                            contract
                        })
                }
            );

        uploadedData =
            await parseCloudinaryResponse(
                response
            );

        return verifyUploadedAsset(
            uploadedData,
            {
                contract,

                originalSize:
                    size,

                purpose:
                    normalizedPurpose
            }
        );
    } catch (error) {
        const publicId =
            cleanText(
                uploadedData
                    ?.public_id ||
                contract
                    ?.publicId
            );

        if (
            publicId &&
            contract
        ) {
            try {
                await cleanupUploadedAsset({
                    purpose:
                        normalizedPurpose,

                    publicId,

                    resourceType:
                        uploadedData
                            ?.resource_type ||
                        (
                            normalizedPurpose ===
                                PURPOSE.LOGO
                                ? 'image'
                                : 'raw'
                        )
                });
            } catch (
                cleanupError
            ) {
                console.error(
                    '[SIMNI Cloudinary] Rollback upload gagal:',
                    cleanupError
                );
            }
        }

        throw error;
    } finally {
        activeUploads =
            Math.max(
                0,
                activeUploads - 1
            );
    }
}

export async function uploadLogo(
    file
) {
    return signedCloudinaryUpload(
        file,
        PURPOSE.LOGO
    );
}

export async function uploadDocument(
    file
) {
    return signedCloudinaryUpload(
        file,
        PURPOSE.DOCUMENT
    );
}

export async function uploadStudentPhoto(
    file
) {
    return signedCloudinaryUpload(
        file,
        PURPOSE.STUDENT_PHOTO
    );
}

export async function deleteCloudinaryAsset(
    publicIdOrOptions,
    resourceTypeArg = 'image',
    purposeArg = null
) {
    let publicId = '';
    let resourceType = resourceTypeArg;
    let purpose = purposeArg;

    if (publicIdOrOptions && typeof publicIdOrOptions === 'object') {
        publicId = publicIdOrOptions.publicId || publicIdOrOptions.public_id || '';
        resourceType = publicIdOrOptions.resourceType || resourceTypeArg;
        purpose = publicIdOrOptions.purpose || purposeArg;
    } else {
        publicId = publicIdOrOptions;
    }

    const normalizedPublicId =
        cleanText(
            publicId
        );

    if (!normalizedPublicId) {
        return {
            ok: true,
            skipped: true
        };
    }

    const resolvedPurpose =
        purpose
            ? normalizePurpose(
                purpose
            )
            : inferPurposeFromPublicId(
                normalizedPublicId
            );

    return cleanupUploadedAsset({
        purpose:
            resolvedPurpose,

        publicId:
            normalizedPublicId,

        resourceType
    });
}

export function getCloudinaryRuntimeSnapshot() {
    return Object.freeze({
        activeUploads,

        purposes:
            Object.freeze({
                ...PURPOSE
            })
    });
}

const SIMNICloudinary =
    Object.freeze({
        signedCloudinaryUpload,

        uploadLogo,

        uploadDocument,

        uploadStudentPhoto,

        deleteCloudinaryAsset,

        getRuntimeSnapshot:
            getCloudinaryRuntimeSnapshot,

        PURPOSE
    });

window.SIMNICloudinary =
    SIMNICloudinary;

export {
    PURPOSE
};

export default SIMNICloudinary;
